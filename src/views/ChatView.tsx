import React, { useCallback, useEffect, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { agentService } from "../services/agentService.js";
import type { AgentEvent, PermissionRequest as IPCPermissionRequest } from "../services/agentTypes.js";
import {
  PermissionDialog,
  type PermissionRequest as DialogPermissionRequest,
  type PermissionResponse as DialogPermissionResponse,
} from "../components/PermissionDialog.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatViewProps {
  sessionId: string;
}

type ChatEntry =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string }
  | {
      kind: "tool";
      id: string;
      toolId: string;
      name: string;
      status: "running" | "done" | "denied";
      result?: string;
      isError?: boolean;
      reason?: string;
    }
  | { kind: "error"; id: string; message: string };

// ---------------------------------------------------------------------------
// Constants — Exe Foundry Bold
// ---------------------------------------------------------------------------

const BG = "#0F0E1A";
const USER_BUBBLE = "#6B4C9A";
const AGENT_BUBBLE = "#1A1930";
const TEXT_COLOR = "#E8E6F0";
const TEXT_DIM = "#cfc6b1";
const GOLD = "#F5D76E";
const GOLD_DARK = "#715c00";
const BORDER = "#2A2845";
const INPUT_BG = "#1b1a27";
const CODE_BG = "#0e0d19";
const CODE_BORDER = "#2a2836";
const TOOL_BG = "#161525";
const TOOL_BORDER = "#2a2845";
const ERROR_BG = "#2a1419";
const ERROR_BORDER = "#5c2333";
const ERROR_TEXT = "#f07080";

// ---------------------------------------------------------------------------
// Marked config
// ---------------------------------------------------------------------------

marked.setOptions({ breaks: true, gfm: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderMarkdown(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml);
}

let entryCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++entryCounter}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UserBubble({ text }: { text: string }) {
  return (
    <div style={userBubbleStyle}>
      <div style={roleLabelStyle}>
        <span style={{ color: GOLD }}>You</span>
      </div>
      <div style={{ color: TEXT_COLOR, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ text }: { text: string }) {
  const html = renderMarkdown(text);
  return (
    <div style={agentBubbleStyle}>
      <div style={roleLabelStyle}>
        <span style={{ color: TEXT_DIM }}>Agent</span>
      </div>
      <div
        className="chat-md"
        style={{ color: TEXT_COLOR, fontSize: 14, lineHeight: 1.6 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function ToolBlock({ entry }: { entry: Extract<ChatEntry, { kind: "tool" }> }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon =
    entry.status === "running"
      ? "\u23F3"
      : entry.status === "denied"
        ? "\u26D4"
        : entry.isError
          ? "\u274C"
          : "\u2705";

  return (
    <div style={toolBlockStyle}>
      <button
        onClick={() => setExpanded((p) => !p)}
        style={toolHeaderStyle}
      >
        <span style={{ fontSize: 12 }}>{statusIcon}</span>
        <span style={toolNameStyle}>{entry.name}</span>
        <span style={{ color: TEXT_DIM, fontSize: 11, marginLeft: "auto" }}>
          {expanded ? "\u25B2" : "\u25BC"}
        </span>
      </button>
      {expanded && (
        <div style={toolBodyStyle}>
          {entry.status === "running" && (
            <span style={{ color: TEXT_DIM, fontSize: 12, fontStyle: "italic" }}>
              Running...
            </span>
          )}
          {entry.status === "denied" && (
            <span style={{ color: ERROR_TEXT, fontSize: 12 }}>
              Denied: {entry.reason ?? "User denied permission"}
            </span>
          )}
          {entry.status === "done" && entry.result && (
            <pre style={toolResultStyle}>{entry.result}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div style={errorBlockStyle}>
      <span style={{ fontSize: 12, color: ERROR_TEXT }}>{message}</span>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div style={loadingStyle}>
      <div className="chat-loading-dots">
        <span /><span /><span />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatInput
// ---------------------------------------------------------------------------

function ChatInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    inputRef.current?.focus();
  }, [value, onSend, disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div style={inputBarStyle}>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Agent is processing..." : "Type a message..."}
        rows={1}
        disabled={disabled}
        style={{
          ...inputFieldStyle,
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        style={{
          ...sendBtnStyle,
          opacity: disabled || !value.trim() ? 0.4 : 1,
          cursor: disabled || !value.trim() ? "default" : "pointer",
        }}
      >
        Send
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ChatView
// ---------------------------------------------------------------------------

export function ChatView({ sessionId }: ChatViewProps) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<{
    request: DialogPermissionRequest;
    resolve: (resp: DialogPermissionResponse) => void;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  // Track current assistant entry ID for streaming text accumulation
  const currentAssistantIdRef = useRef<string | null>(null);

  // Auto-scroll when entries change
  useEffect(() => {
    if (!autoScrollRef.current) return;
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [entries, isLoading]);

  // Track scroll position for auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    autoScrollRef.current = distFromBottom < 50;
  }, []);

  // Subscribe to agentService events
  useEffect(() => {
    const handleEvent = (sid: string, event: AgentEvent) => {
      if (sid !== sessionId) return;

      switch (event.type) {
        case "text": {
          setEntries((prev) => {
            const id = currentAssistantIdRef.current;
            if (id) {
              // Append to existing assistant entry
              return prev.map((e) =>
                e.kind === "assistant" && e.id === id
                  ? { ...e, text: e.text + event.text }
                  : e,
              );
            }
            // Start new assistant entry
            const newId = nextId("ast");
            currentAssistantIdRef.current = newId;
            return [...prev, { kind: "assistant", id: newId, text: event.text }];
          });
          setIsLoading(false);
          break;
        }

        case "tool_use_start": {
          // Flush current assistant buffer — new text after tool will start fresh
          currentAssistantIdRef.current = null;
          setEntries((prev) => [
            ...prev,
            {
              kind: "tool",
              id: nextId("tool"),
              toolId: event.id,
              name: event.name,
              status: "running",
            },
          ]);
          break;
        }

        case "tool_result": {
          setEntries((prev) =>
            prev.map((e) =>
              e.kind === "tool" && e.toolId === event.id
                ? {
                    ...e,
                    status: "done" as const,
                    result: event.result.content,
                    isError: event.result.isError,
                  }
                : e,
            ),
          );
          break;
        }

        case "tool_denied": {
          setEntries((prev) =>
            prev.map((e) =>
              e.kind === "tool" && e.toolId === event.id
                ? { ...e, status: "denied" as const, reason: event.reason }
                : e,
            ),
          );
          break;
        }

        case "turn_complete":
        case "done": {
          currentAssistantIdRef.current = null;
          setIsLoading(false);
          break;
        }

        case "error": {
          currentAssistantIdRef.current = null;
          setIsLoading(false);
          setEntries((prev) => [
            ...prev,
            { kind: "error", id: nextId("err"), message: event.message },
          ]);
          break;
        }

        case "aborted": {
          currentAssistantIdRef.current = null;
          setIsLoading(false);
          setEntries((prev) => [
            ...prev,
            { kind: "error", id: nextId("err"), message: `Aborted: ${event.reason}` },
          ]);
          break;
        }
      }
    };

    const unsubEvent = agentService.onEvent(handleEvent);

    // Permission handler — bridges IPC PermissionRequest to PermissionDialog
    const unsubPermission = agentService.onPermissionRequest(
      (req: IPCPermissionRequest) =>
        new Promise((resolve) => {
          setPendingPermission({
            request: {
              toolName: req.name,
              description: req.description,
              filePath: req.filePath,
            },
            resolve: (decision: DialogPermissionResponse) => {
              setPendingPermission(null);
              resolve({
                sessionId: req.sessionId,
                toolCallId: req.id,
                decision: decision === "deny" ? "deny" : "allow",
              });
            },
          });
        }),
    );

    return () => {
      unsubEvent();
      unsubPermission();
    };
  }, [sessionId]);

  // Send handler
  const handleSend = useCallback(
    (text: string) => {
      const userEntry: ChatEntry = {
        kind: "user",
        id: nextId("usr"),
        text,
      };
      setEntries((prev) => [...prev, userEntry]);
      currentAssistantIdRef.current = null;
      setIsLoading(true);
      autoScrollRef.current = true;
      agentService.sendMessage(sessionId, text);
    },
    [sessionId],
  );

  return (
    <div style={containerStyle}>
      {/* Message list */}
      <div ref={scrollRef} onScroll={handleScroll} className="chat-scroll" style={scrollAreaStyle}>
        {entries.length === 0 && !isLoading && (
          <div style={emptyStateStyle}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: GOLD, opacity: 0.4 }}>
              chat
            </span>
            <span style={{ color: TEXT_DIM, fontSize: 13, marginTop: 8 }}>
              Send a message to start
            </span>
          </div>
        )}
        {entries.map((entry) => {
          switch (entry.kind) {
            case "user":
              return <UserBubble key={entry.id} text={entry.text} />;
            case "assistant":
              return <AssistantBubble key={entry.id} text={entry.text} />;
            case "tool":
              return <ToolBlock key={entry.id} entry={entry} />;
            case "error":
              return <ErrorBlock key={entry.id} message={entry.message} />;
          }
        })}
        {isLoading && <LoadingIndicator />}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} />

      {/* Permission dialog overlay */}
      {pendingPermission && (
        <PermissionDialog
          request={pendingPermission.request}
          onRespond={pendingPermission.resolve}
        />
      )}

      {/* Scoped styles */}
      <style>{`
        .chat-md p { margin: 0 0 8px; }
        .chat-md p:last-child { margin-bottom: 0; }
        .chat-md h1, .chat-md h2, .chat-md h3 {
          font-family: Epilogue, sans-serif;
          color: #fff4dc;
          margin: 12px 0 6px;
          letter-spacing: -0.02em;
        }
        .chat-md h1 { font-size: 18px; }
        .chat-md h2 { font-size: 16px; }
        .chat-md h3 { font-size: 14px; }
        .chat-md code {
          background: ${CODE_BG};
          border: 1px solid ${CODE_BORDER};
          padding: 2px 6px;
          font-family: "Space Grotesk", monospace;
          font-size: 12px;
          color: ${GOLD};
        }
        .chat-md pre {
          background: ${CODE_BG};
          border: 1px solid ${CODE_BORDER};
          padding: 12px;
          overflow-x: auto;
          margin: 8px 0;
        }
        .chat-md pre code {
          border: none;
          padding: 0;
          font-size: 12px;
          color: ${TEXT_COLOR};
          background: transparent;
        }
        .chat-md table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
          font-size: 13px;
        }
        .chat-md th, .chat-md td {
          border: 1px solid ${BORDER};
          padding: 6px 10px;
          text-align: left;
        }
        .chat-md th {
          background: ${CODE_BG};
          font-weight: 600;
          color: ${TEXT_DIM};
        }
        .chat-md ul, .chat-md ol { margin: 4px 0; padding-left: 20px; }
        .chat-md li { margin-bottom: 4px; }
        .chat-md blockquote {
          border-left: 3px solid ${BORDER};
          margin: 8px 0;
          padding: 4px 12px;
          color: ${TEXT_DIM};
        }
        .chat-md a {
          color: ${GOLD};
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .chat-md strong { color: #fff4dc; font-weight: 700; }
        .chat-md em { font-style: italic; }

        .chat-loading-dots {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
        }
        .chat-loading-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${TEXT_DIM};
          animation: chatDotPulse 1.2s infinite ease-in-out;
        }
        .chat-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .chat-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes chatDotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }

        /* Scrollbar */
        .chat-scroll::-webkit-scrollbar { width: 6px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: BG,
  position: "relative",
};

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  padding: "16px 16px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const emptyStateStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 0,
};

const roleLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "Manrope, sans-serif",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 600,
  marginBottom: 4,
};

const bubbleBase: React.CSSProperties = {
  maxWidth: "85%",
  padding: "10px 14px",
  fontFamily: "Epilogue, sans-serif",
  wordBreak: "break-word",
};

const userBubbleStyle: React.CSSProperties = {
  ...bubbleBase,
  alignSelf: "flex-end",
  background: USER_BUBBLE,
  border: "1px solid rgba(245, 215, 110, 0.08)",
};

const agentBubbleStyle: React.CSSProperties = {
  ...bubbleBase,
  alignSelf: "flex-start",
  background: AGENT_BUBBLE,
  border: "1px solid rgba(255, 255, 255, 0.04)",
};

const toolBlockStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  maxWidth: "85%",
  background: TOOL_BG,
  border: `1px solid ${TOOL_BORDER}`,
  fontSize: 12,
};

const toolHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "8px 12px",
  background: "transparent",
  border: "none",
  color: TEXT_COLOR,
  cursor: "pointer",
  fontFamily: "Manrope, sans-serif",
  fontSize: 12,
  textAlign: "left",
};

const toolNameStyle: React.CSSProperties = {
  fontFamily: "'Space Grotesk', monospace",
  fontWeight: 600,
  color: GOLD,
  fontSize: 12,
};

const toolBodyStyle: React.CSSProperties = {
  padding: "0 12px 10px",
  borderTop: `1px solid ${TOOL_BORDER}`,
  paddingTop: 8,
};

const toolResultStyle: React.CSSProperties = {
  fontFamily: "'Space Grotesk', monospace",
  fontSize: 11,
  color: TEXT_DIM,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  margin: 0,
  maxHeight: 200,
  overflowY: "auto",
};

const errorBlockStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "8px 12px",
  background: ERROR_BG,
  border: `1px solid ${ERROR_BORDER}`,
  maxWidth: "85%",
};

const loadingStyle: React.CSSProperties = {
  alignSelf: "flex-start",
};

const inputBarStyle: React.CSSProperties = {
  padding: "12px 16px",
  background: BG,
  borderTop: `1px solid ${BORDER}`,
  display: "flex",
  gap: 8,
  alignItems: "flex-end",
  flexShrink: 0,
};

const inputFieldStyle: React.CSSProperties = {
  flex: 1,
  resize: "none",
  background: INPUT_BG,
  border: `1px solid ${BORDER}`,
  color: TEXT_COLOR,
  padding: "10px 14px",
  fontSize: 14,
  fontFamily: "Epilogue, sans-serif",
  outline: "none",
  lineHeight: 1.5,
  minHeight: 40,
  maxHeight: 120,
};

const sendBtnStyle: React.CSSProperties = {
  background: GOLD,
  color: GOLD_DARK,
  border: "none",
  padding: "10px 20px",
  fontSize: 12,
  fontFamily: "Manrope, sans-serif",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  flexShrink: 0,
};
