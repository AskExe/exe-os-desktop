/**
 * Agent service — WebSocket client for the exe-os IPC server.
 *
 * Manages a persistent connection with auto-reconnect (exponential backoff),
 * event buffering, and subscription-based event delivery. Used by ChatView,
 * PermissionDialog, and session management UI.
 *
 * Usage:
 *   import { agentService } from "./agentService.js";
 *   await agentService.connect(9221);
 *   const unsub = agentService.onEvent((sid, ev) => { ... });
 */

import type {
  AgentEvent,
  IPCCommand,
  IPCResponse,
  SessionInfo,
  PermissionRequest,
  PermissionResponse,
} from "./agentTypes.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventHandler = (sessionId: string, event: AgentEvent) => void;
type PermissionHandler = (req: PermissionRequest) => Promise<PermissionResponse>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class AgentServiceImpl {
  private ws: WebSocket | null = null;
  private port: number | null = null;
  private eventHandlers = new Set<EventHandler>();
  private permissionHandler: PermissionHandler | null = null;
  private sessions = new Map<string, SessionInfo>();
  private eventBuffer: Array<{ sessionId: string; event: AgentEvent }> = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private intentionalClose = false;
  private connectedUrl: string | null = null;
  private pendingSessionStart: {
    resolve: (sessionId: string) => void;
    reject: (err: Error) => void;
  } | null = null;

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Connect to the IPC WebSocket server on the given port. */
  connect(port: number): Promise<void> {
    if (this.ws) {
      this.disconnect();
    }
    this.port = port;
    this.intentionalClose = false;
    return this.doConnect();
  }

  /** Cleanly close the connection (no auto-reconnect). */
  disconnect(): void {
    this.intentionalClose = true;
    this.connectedUrl = null;
    this.clearReconnect();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** Whether the WebSocket is currently open. */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Start a new agent session. Resolves with the assigned session ID. */
  startSession(config: {
    agentId: string;
    model: string;
    systemPrompt: string;
  }): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (this.pendingSessionStart) {
        reject(new Error("A session start is already pending"));
        return;
      }
      this.pendingSessionStart = { resolve, reject };
      this.send({ type: "start_session", ...config });
    });
  }

  /** Stop an active session. */
  stopSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.send({ type: "stop_session", sessionId });
  }

  /** Return the cached list of known sessions. */
  listSessions(): SessionInfo[] {
    return [...this.sessions.values()];
  }

  /** Send a user message to an active session. */
  sendMessage(sessionId: string, text: string): void {
    this.send({ type: "send_message", sessionId, text });
  }

  /**
   * Subscribe to agent events. Returns an unsubscribe function.
   * Flushes any buffered events to the new handler immediately.
   */
  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);

    // Flush buffered events to the new subscriber
    if (this.eventBuffer.length > 0) {
      const buffered = this.eventBuffer;
      this.eventBuffer = [];
      for (const { sessionId, event } of buffered) {
        handler(sessionId, event);
      }
    }

    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to permission requests. Returns an unsubscribe function.
   * Only one handler is active at a time (last-write-wins).
   */
  onPermissionRequest(handler: PermissionHandler): () => void {
    this.permissionHandler = handler;
    return () => {
      if (this.permissionHandler === handler) {
        this.permissionHandler = null;
      }
    };
  }

  // -------------------------------------------------------------------------
  // Connection management
  // -------------------------------------------------------------------------

  private doConnect(): Promise<void> {
    // Reconnect to the last successful URL when possible
    if (this.connectedUrl) {
      return this.attemptConnect(this.connectedUrl).catch(() => {
        this.connectedUrl = null;
        return this.doConnect();
      });
    }
    // Primary; fall back to 127.0.0.1 for WSL2 cross-boundary compat
    return this.attemptConnect(`ws://localhost:${this.port}`).catch(() =>
      this.attemptConnect(`ws://127.0.0.1:${this.port}`),
    );
  }

  private attemptConnect(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      let opened = false;

      ws.addEventListener("open", () => {
        opened = true;
        this.ws = ws;
        this.connectedUrl = url;
        this.reconnectDelay = RECONNECT_BASE_MS;
        resolve();
      });

      ws.addEventListener("message", (ev) => {
        this.handleMessage(ev.data as string);
      });

      ws.addEventListener("close", () => {
        if (opened) {
          this.ws = null;
          if (!this.intentionalClose) {
            this.scheduleReconnect();
          }
        }
      });

      ws.addEventListener("error", () => {
        if (!opened) {
          reject(new Error(`WebSocket connection failed: ${url}`));
        }
      });
    });
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect().catch(() => {
        // close event on the failed socket will trigger the next attempt
      });
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        RECONNECT_MAX_MS,
      );
    }, this.reconnectDelay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Message handling
  // -------------------------------------------------------------------------

  private handleMessage(raw: string): void {
    let msg: IPCResponse;
    try {
      msg = JSON.parse(raw) as IPCResponse;
    } catch {
      return;
    }

    switch (msg.type) {
      case "event":
        this.emitEvent(msg.sessionId, msg.event);
        break;

      case "session_started":
        if (this.pendingSessionStart) {
          this.sessions.set(msg.sessionId, {
            sessionId: msg.sessionId,
            agentId: "",
            model: "",
            startedAt: new Date().toISOString(),
            status: "running",
          });
          this.pendingSessionStart.resolve(msg.sessionId);
          this.pendingSessionStart = null;
        }
        break;

      case "sessions":
        this.sessions.clear();
        for (const s of msg.sessions) {
          this.sessions.set(s.sessionId, s);
        }
        break;

      case "pong":
        break;

      case "error":
        if (this.pendingSessionStart) {
          this.pendingSessionStart.reject(new Error(msg.message));
          this.pendingSessionStart = null;
        }
        break;
    }
  }

  private emitEvent(sessionId: string, event: AgentEvent): void {
    // Route permission requests to the dedicated handler
    if (event.type === "permission_request" && this.permissionHandler) {
      const req: PermissionRequest = {
        sessionId,
        name: event.name,
        id: event.id,
        description: event.description,
        filePath: event.filePath,
      };
      this.permissionHandler(req).then((resp) => {
        this.send({
          type: "permission_response",
          sessionId: resp.sessionId,
          toolCallId: resp.toolCallId,
          decision: resp.decision,
        });
      });
      return;
    }

    // Buffer events if no handlers are subscribed yet
    if (this.eventHandlers.size === 0) {
      this.eventBuffer.push({ sessionId, event });
      return;
    }

    for (const handler of this.eventHandlers) {
      handler(sessionId, event);
    }
  }

  // -------------------------------------------------------------------------
  // Transport
  // -------------------------------------------------------------------------

  private send(cmd: IPCCommand): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(cmd));
    }
  }
}

/** Singleton agent service instance */
export const agentService = new AgentServiceImpl();
