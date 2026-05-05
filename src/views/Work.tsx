import { useEffect, useMemo, useState } from "react";
import { fetchTasks, type Task } from "../services/exeOsData.js";
import { ChatView } from "./ChatView.js";
import { SessionControls } from "../components/SessionControls.js";

type StatusFilter = "all" | Task["status"];
type PriorityFilter = "all" | Task["priority"];
export type WorkMode = "tasks" | "chat";

interface WorkChatRequest {
  employeeName?: string;
  nonce: number;
}

interface WorkViewProps {
  chatRequest?: WorkChatRequest | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<Task["status"], string> = {
  open: "#98907d",
  in_progress: "#F5D76E",
  done: "#22C55E",
  blocked: "#EF4444",
};

const STATUS_LABEL: Record<Task["status"], string> = {
  open: "OPEN",
  in_progress: "IN PROGRESS",
  done: "DONE",
  blocked: "BLOCKED",
};

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  p0: "#EF4444",
  p1: "#F5D76E",
  p2: "#98907d",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatEmployeeName(name: string): string {
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
    height: "100%",
    overflow: "auto",
  },
  summaryBar: {
    display: "flex",
    gap: 8,
  },
  summaryCard: (active: boolean) => ({
    flex: 1,
    padding: 16,
    background: active ? "var(--surface-high)" : "var(--surface-low)",
    cursor: "pointer",
    transition: "background 0.15s",
  }),
  summaryLabel: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--outline)",
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: "var(--font-headline)",
    fontSize: 28,
    fontWeight: 700,
    color: "var(--on-surface)",
  },
  filterBar: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  filterChip: (active: boolean) => ({
    padding: "4px 12px",
    fontFamily: "var(--font-label)",
    fontSize: 12,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: active ? "var(--on-primary-container)" : "var(--outline)",
    background: active ? "var(--primary-container)" : "var(--surface-container)",
    cursor: "pointer",
    border: "none",
    transition: "background 0.15s, color 0.15s",
  }),
  contentArea: {
    display: "flex",
    gap: 8,
    flex: 1,
    minHeight: 0,
  },
  taskList: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    flexDirection: "column" as const,
  },
  taskRow: (selected: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "10px 16px",
    background: selected ? "var(--surface-high)" : "transparent",
    cursor: "pointer",
    transition: "background 0.1s",
  }),
  dot: (color: string) => ({
    width: 8,
    height: 8,
    background: color,
    flexShrink: 0,
  }),
  taskTitle: {
    flex: 1,
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: "var(--on-surface)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  badge: (color: string) => ({
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color,
    padding: "2px 8px",
    background: color + "18",
  }),
  assignee: {
    fontFamily: "var(--font-label)",
    fontSize: 12,
    color: "var(--outline)",
    width: 60,
    textAlign: "right" as const,
  },
  timeLabel: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    color: "var(--outline-variant)",
    width: 60,
    textAlign: "right" as const,
  },
  detailPanel: {
    width: 320,
    background: "var(--surface-low)",
    padding: 24,
    overflow: "auto",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  detailHeadline: {
    fontFamily: "var(--font-headline)",
    fontSize: 16,
    fontWeight: 700,
    color: "var(--on-surface)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.02em",
  },
  detailField: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  detailLabel: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--outline)",
  },
  detailValue: {
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: "var(--on-surface)",
  },
  sectionTitle: {
    fontFamily: "var(--font-headline)",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "var(--outline)",
    padding: "8px 16px",
  },
  officeFocusCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    padding: 16,
    marginBottom: 12,
    background: "var(--surface-low)",
    border: "1px solid var(--outline-variant)",
  },
  officeFocusLabel: {
    fontFamily: "var(--font-label)",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--outline)",
  },
  officeFocusName: {
    fontFamily: "var(--font-headline)",
    fontSize: 18,
    color: "var(--primary-container)",
  },
  officeFocusBody: {
    fontFamily: "var(--font-body)",
    fontSize: 13,
    color: "var(--on-surface-variant)",
    lineHeight: 1.5,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkView({ chatRequest }: WorkViewProps = {}) {
  const [mode, setMode] = useState<WorkMode>("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reviewTasks, setReviewTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [requestedAgentName, setRequestedAgentName] = useState<string | undefined>(
    undefined,
  );
  const [requestToken, setRequestToken] = useState<number>(0);

  useEffect(() => {
    fetchTasks().then(({ tasks: t, reviewTasks: r }) => {
      setTasks(t);
      setReviewTasks(r);
    });
  }, []);

  useEffect(() => {
    if (!chatRequest) return;
    setMode("chat");
    setRequestedAgentName(chatRequest.employeeName);
    setRequestToken(chatRequest.nonce);
    setActiveSessionId(null);
  }, [chatRequest]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, priorityFilter]);

  const selected = useMemo(
    () => [...tasks, ...reviewTasks].find((t) => t.id === selectedId) ?? null,
    [tasks, reviewTasks, selectedId],
  );

  const counts = useMemo(() => ({
    total: tasks.length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
    done: tasks.filter((t) => t.status === "done").length,
  }), [tasks]);

  return (
    <div style={s.container}>
      {/* Mode toggle: Tasks / Chat */}
      <div style={s.filterBar}>
        <button
          style={s.filterChip(mode === "tasks")}
          onClick={() => setMode("tasks")}
        >
          Tasks
        </button>
        <button
          style={s.filterChip(mode === "chat")}
          onClick={() => setMode("chat")}
        >
          Agent Chat
        </button>
      </div>

      {mode === "chat" ? (
        <div style={{ display: "flex", flex: 1, gap: 8, minHeight: 0 }}>
          <div style={{ width: 300, flexShrink: 0, overflow: "auto" }}>
            {requestedAgentName && (
              <div style={s.officeFocusCard}>
                <div style={s.officeFocusLabel}>Routed From Office</div>
                <div style={s.officeFocusName}>{formatEmployeeName(requestedAgentName)}</div>
                <div style={s.officeFocusBody}>
                  Selecting a live session for this agent when available. If one is
                  not running, the new-session form is prefilled.
                </div>
              </div>
            )}
            <SessionControls
              onSelectSession={setActiveSessionId}
              requestedAgentName={requestedAgentName}
              requestToken={requestToken}
            />
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {activeSessionId ? (
              <ChatView sessionId={activeSessionId} />
            ) : (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--outline)",
                fontFamily: "var(--font-body)",
                fontSize: 14,
              }}>
                Select or start a session to begin chatting
              </div>
            )}
          </div>
        </div>
      ) : (
      <>
      {/* Summary bar */}
      <div style={s.summaryBar}>
        {([
          { label: "Total", value: counts.total, filter: "all" as StatusFilter },
          { label: "In Progress", value: counts.inProgress, filter: "in_progress" as StatusFilter },
          { label: "Blocked", value: counts.blocked, filter: "blocked" as StatusFilter },
          { label: "Completed", value: counts.done, filter: "done" as StatusFilter },
        ]).map((card) => (
          <div
            key={card.label}
            style={s.summaryCard(statusFilter === card.filter)}
            onClick={() => setStatusFilter(card.filter === statusFilter ? "all" : card.filter)}
          >
            <div style={s.summaryLabel}>{card.label}</div>
            <div style={s.summaryValue}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div style={s.filterBar}>
        <span style={{ ...s.summaryLabel, marginBottom: 0 }}>Priority:</span>
        {(["all", "p0", "p1", "p2"] as PriorityFilter[]).map((p) => (
          <button
            key={p}
            style={s.filterChip(priorityFilter === p)}
            onClick={() => setPriorityFilter(p)}
          >
            {p === "all" ? "All" : p.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content: task list + detail panel */}
      <div style={s.contentArea}>
        <div style={s.taskList}>
          <div style={s.sectionTitle}>Tasks</div>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, color: "var(--outline)", fontFamily: "var(--font-body)", fontSize: 14 }}>
              No tasks match filters.
            </div>
          ) : (
            filtered.map((task) => (
              <div
                key={task.id}
                style={s.taskRow(selectedId === task.id)}
                onClick={() => setSelectedId(task.id)}
              >
                <div style={s.dot(STATUS_DOT[task.status])} />
                <div style={s.taskTitle}>{task.title}</div>
                <div style={s.badge(PRIORITY_COLOR[task.priority])}>{task.priority.toUpperCase()}</div>
                <div style={s.assignee}>{task.assignedTo}</div>
                <div style={s.timeLabel}>{timeAgo(task.updatedAt)}</div>
              </div>
            ))
          )}

          {/* Reviews section */}
          <div style={{ ...s.sectionTitle, marginTop: 16 }}>Pending Reviews</div>
          {reviewTasks.filter((t) => t.status === "open").map((task) => (
            <div
              key={task.id}
              style={s.taskRow(selectedId === task.id)}
              onClick={() => setSelectedId(task.id)}
            >
              <div style={s.dot(STATUS_DOT[task.status])} />
              <div style={s.taskTitle}>{task.title}</div>
              <div style={s.badge(PRIORITY_COLOR[task.priority])}>{task.priority.toUpperCase()}</div>
              <div style={s.timeLabel}>{timeAgo(task.updatedAt)}</div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={s.detailPanel}>
            <div style={s.detailHeadline}>{selected.title}</div>
            <div style={s.detailField}>
              <div style={s.detailLabel}>Status</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={s.dot(STATUS_DOT[selected.status])} />
                <span style={s.detailValue}>{STATUS_LABEL[selected.status]}</span>
              </div>
            </div>
            <div style={s.detailField}>
              <div style={s.detailLabel}>Priority</div>
              <div style={s.badge(PRIORITY_COLOR[selected.priority])}>{selected.priority.toUpperCase()}</div>
            </div>
            <div style={s.detailField}>
              <div style={s.detailLabel}>Assigned To</div>
              <div style={s.detailValue}>{selected.assignedTo}</div>
            </div>
            <div style={s.detailField}>
              <div style={s.detailLabel}>Project</div>
              <div style={s.detailValue}>{selected.project}</div>
            </div>
            <div style={s.detailField}>
              <div style={s.detailLabel}>Created</div>
              <div style={s.detailValue}>{new Date(selected.createdAt).toLocaleDateString()}</div>
            </div>
            <div style={s.detailField}>
              <div style={s.detailLabel}>Updated</div>
              <div style={s.detailValue}>{timeAgo(selected.updatedAt)}</div>
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
