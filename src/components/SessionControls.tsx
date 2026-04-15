import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { agentService } from "../services/agentService.js";
import type { SessionInfo } from "../services/agentTypes.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DaemonStatus {
  running: boolean;
  port: number;
  pid: number;
}

const AGENTS = ["yoshi", "tom", "mari", "sasha"] as const;
const DEFAULT_MODEL = "claude-opus-4-6";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<SessionInfo["status"], string> = {
  running: "#4CAF50",
  stopped: "#E74C3C",
  error: "#F5D76E",
};

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    height: "100%",
    overflow: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontFamily: "var(--font-headline)",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "var(--outline)",
  },
  newBtn: {
    padding: "6px 16px",
    fontFamily: "var(--font-label)",
    fontSize: 12,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "var(--on-primary-container)",
    background: "var(--primary-container)",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    transition: "background 0.15s, color 0.15s",
  },
  sessionCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    background: "var(--surface-low)",
    border: "1px solid var(--surface-high)",
    transition: "background 0.1s",
  },
  dot: (color: string) => ({
    width: 8,
    height: 8,
    flexShrink: 0,
    background: color,
    boxShadow: `0 0 6px ${color}80`,
  }),
  agentName: {
    fontFamily: "var(--font-body)",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--on-surface)",
    flex: 1,
  },
  sessionId: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    color: "var(--outline)",
    letterSpacing: "0.02em",
  },
  statusLabel: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
  },
  stopBtn: {
    padding: "4px 12px",
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "#E74C3C",
    background: "#E74C3C18",
    border: "1px solid #E74C3C40",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  emptyState: {
    padding: 24,
    textAlign: "center" as const,
    color: "var(--outline)",
    fontFamily: "var(--font-body)",
    fontSize: 14,
  },
  // New session form
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    padding: 16,
    background: "var(--surface-low)",
    border: "1px solid var(--surface-high)",
  },
  formField: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  formLabel: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--outline)",
  },
  select: {
    padding: "8px 12px",
    fontFamily: "var(--font-label)",
    fontSize: 13,
    color: "var(--on-surface)",
    background: "var(--surface-container)",
    border: "1px solid var(--outline-variant)",
    outline: "none",
  },
  formActions: {
    display: "flex",
    gap: 8,
    marginTop: 4,
  },
  startBtn: {
    padding: "6px 16px",
    fontFamily: "var(--font-label)",
    fontSize: 12,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "var(--on-primary-container)",
    background: "var(--primary-container)",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
  cancelBtn: {
    padding: "6px 16px",
    fontFamily: "var(--font-label)",
    fontSize: 12,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "var(--outline)",
    background: "var(--surface-container)",
    border: "none",
    cursor: "pointer",
  },
  daemonBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
  },
  disabledOverlay: {
    opacity: 0.4,
    pointerEvents: "none" as const,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SessionControlsProps {
  onSelectSession?: (sessionId: string) => void;
}

export function SessionControls({ onSelectSession }: SessionControlsProps = {}) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [agentId, setAgentId] = useState<string>(AGENTS[0]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [starting, setStarting] = useState(false);
  const [confirmStop, setConfirmStop] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Daemon status polling ----
  const checkDaemon = useCallback(async () => {
    try {
      const status = await invoke<DaemonStatus>("daemon_status");
      setDaemon(status);
    } catch {
      setDaemon({ running: false, port: 0, pid: 0 });
    }
  }, []);

  // ---- Session polling ----
  const refreshSessions = useCallback(() => {
    setSessions(agentService.listSessions());
  }, []);

  useEffect(() => {
    checkDaemon();
    refreshSessions();

    // Poll every 5s
    pollRef.current = setInterval(() => {
      checkDaemon();
      refreshSessions();
    }, 5000);

    // Subscribe to agent events for real-time updates
    const unsub = agentService.onEvent(() => {
      refreshSessions();
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      unsub();
    };
  }, [checkDaemon, refreshSessions]);

  // ---- Actions ----
  const handleStart = async () => {
    if (!daemon?.running) return;
    setStarting(true);
    try {
      await agentService.startSession({
        agentId,
        model,
        systemPrompt: "",
      });
      refreshSessions();
      setShowForm(false);
    } catch {
      // error handled by agentService event system
    } finally {
      setStarting(false);
    }
  };

  const handleStop = (sessionId: string) => {
    if (confirmStop === sessionId) {
      agentService.stopSession(sessionId);
      setConfirmStop(null);
      // Immediate UI update
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } else {
      setConfirmStop(sessionId);
    }
  };

  const daemonRunning = daemon?.running ?? false;

  return (
    <div style={s.container}>
      {/* Daemon status bar */}
      <div style={s.daemonBar}>
        <div
          style={s.dot(daemonRunning ? "#4CAF50" : "#E74C3C")}
        />
        <span style={{ color: daemonRunning ? "#4CAF50" : "#E74C3C" }}>
          Daemon: {daemonRunning ? "Running" : "Stopped"}
        </span>
        {daemon && daemonRunning && (
          <span style={{ color: "var(--outline)", marginLeft: 8 }}>
            Port {daemon.port} &middot; PID {daemon.pid}
          </span>
        )}
      </div>

      {/* Session controls — disabled when daemon is down */}
      <div style={daemonRunning ? undefined : s.disabledOverlay}>
        {/* Header */}
        <div style={s.header}>
          <span style={s.sectionTitle}>Sessions</span>
          <button
            style={s.newBtn}
            onClick={() => setShowForm(!showForm)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#6B4C9A";
              e.currentTarget.style.color = "#F5D76E";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--primary-container)";
              e.currentTarget.style.color = "var(--on-primary-container)";
            }}
            disabled={!daemonRunning}
          >
            {showForm ? "Cancel" : "New Session"}
          </button>
        </div>

        {/* New session form */}
        {showForm && (
          <div style={s.form}>
            <div style={s.formField}>
              <label style={s.formLabel}>Agent</label>
              <select
                style={s.select}
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                {AGENTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div style={s.formField}>
              <label style={s.formLabel}>Model</label>
              <select
                style={s.select}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="claude-opus-4-6">claude-opus-4-6</option>
                <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
                <option value="claude-haiku-4-5-20251001">claude-haiku-4-5</option>
              </select>
            </div>
            <div style={s.formActions}>
              <button
                style={{
                  ...s.startBtn,
                  opacity: starting ? 0.6 : 1,
                }}
                onClick={handleStart}
                disabled={starting}
              >
                {starting ? "Starting..." : "Start"}
              </button>
              <button style={s.cancelBtn} onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Session list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
          {sessions.length === 0 ? (
            <div style={s.emptyState}>No active sessions.</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.sessionId}
                style={{ ...s.sessionCard, cursor: onSelectSession ? "pointer" : "default" }}
                onClick={() => onSelectSession?.(session.sessionId)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--surface-container)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--surface-low)";
                }}
              >
                <div style={s.dot(STATUS_COLORS[session.status])} />
                <span style={s.agentName}>{session.agentId || "agent"}</span>
                <span style={s.sessionId}>
                  {session.sessionId.slice(0, 8)}
                </span>
                <span
                  style={{
                    ...s.statusLabel,
                    color: STATUS_COLORS[session.status],
                  }}
                >
                  {session.status}
                </span>
                {session.status === "running" && (
                  <button
                    style={s.stopBtn}
                    onClick={() => handleStop(session.sessionId)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#E74C3C30";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#E74C3C18";
                    }}
                  >
                    {confirmStop === session.sessionId ? "Confirm" : "Stop"}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
