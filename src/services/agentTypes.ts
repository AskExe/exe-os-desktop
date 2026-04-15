/**
 * Agent IPC types — local mirrors of exe-os runtime types.
 *
 * The desktop can't import exe-os source directly (Tauri IPC boundary),
 * so we define compatible types here. Keep in sync with:
 *   exe-os/src/runtime/agent-loop.ts  (AgentEvent)
 *   exe-os/src/runtime/ipc.ts         (IPCCommand, IPCResponse)
 *   exe-os/src/runtime/tool-types.ts  (ToolResult)
 */

// ---------------------------------------------------------------------------
// Tool types (from exe-os/src/runtime/tool-types.ts)
// ---------------------------------------------------------------------------

export interface ToolResult {
  content: string;
  isError?: boolean;
  sideEffects?: {
    filesModified?: string[];
    contextChanged?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Agent events (from exe-os/src/runtime/agent-loop.ts)
// ---------------------------------------------------------------------------

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_use_start"; name: string; id: string }
  | { type: "tool_result"; name: string; id: string; result: ToolResult }
  | { type: "tool_denied"; name: string; id: string; reason: string }
  | { type: "turn_complete"; turn: number; usage: TokenUsage }
  | { type: "aborted"; reason: string }
  | { type: "error"; message: string }
  | { type: "done"; totalUsage: TokenUsage; turns: number }
  | { type: "permission_request"; name: string; id: string; description: string; filePath?: string };

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// ---------------------------------------------------------------------------
// IPC protocol (from exe-os/src/runtime/ipc.ts)
// ---------------------------------------------------------------------------

/** Commands sent from desktop to the IPC WebSocket server */
export type IPCCommand =
  | { type: "send_message"; sessionId: string; text: string }
  | { type: "start_session"; agentId: string; model: string; systemPrompt: string }
  | { type: "stop_session"; sessionId: string }
  | { type: "list_sessions" }
  | { type: "permission_response"; sessionId: string; toolCallId: string; decision: "allow" | "deny" }
  | { type: "ping" };

/** Responses received from the IPC WebSocket server */
export type IPCResponse =
  | { type: "event"; sessionId: string; event: AgentEvent }
  | { type: "session_started"; sessionId: string }
  | { type: "sessions"; sessions: SessionInfo[] }
  | { type: "pong" }
  | { type: "error"; message: string };

// ---------------------------------------------------------------------------
// Session & permission types
// ---------------------------------------------------------------------------

export interface SessionInfo {
  sessionId: string;
  agentId: string;
  model: string;
  startedAt: string;
  status: "running" | "stopped" | "error";
}

export interface PermissionRequest {
  sessionId: string;
  name: string;
  id: string;
  description: string;
  filePath?: string;
}

export interface PermissionResponse {
  sessionId: string;
  toolCallId: string;
  decision: "allow" | "deny";
}
