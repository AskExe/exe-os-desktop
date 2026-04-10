import React, { useState, useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Task {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done" | "blocked";
  priority: "p0" | "p1" | "p2";
  assignedTo: string;
  project: string;
  createdAt: string;
  updatedAt: string;
}

type StatusFilter = "all" | Task["status"];
type PriorityFilter = "all" | Task["priority"];

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const DEMO_TASKS: Task[] = [
  {
    id: "1", title: "Wire agent loop into TUI CommandCenter",
    status: "done", priority: "p1", assignedTo: "tom",
    project: "exe-os", createdAt: "2026-04-10T05:40:00Z", updatedAt: "2026-04-10T06:12:00Z",
  },
  {
    id: "2", title: "Rebrand exe-wiki frontend — Exe Foundry Bold",
    status: "done", priority: "p0", assignedTo: "tom",
    project: "exe-wiki", createdAt: "2026-04-10T01:35:00Z", updatedAt: "2026-04-10T01:44:00Z",
  },
  {
    id: "3", title: "Desktop Work tab — task management dashboard",
    status: "in_progress", priority: "p1", assignedTo: "tom",
    project: "exe-os-desktop", createdAt: "2026-04-10T07:00:00Z", updatedAt: "2026-04-10T07:05:00Z",
  },
  {
    id: "4", title: "Brand audit — exe-wiki colors and typography",
    status: "open", priority: "p1", assignedTo: "mari",
    project: "exe-wiki", createdAt: "2026-04-10T01:38:00Z", updatedAt: "2026-04-10T01:38:00Z",
  },
  {
    id: "5", title: "GraphRAG confidence scoring — decay + corroboration",
    status: "done", priority: "p1", assignedTo: "yoshi",
    project: "exe-os", createdAt: "2026-04-09T20:00:00Z", updatedAt: "2026-04-09T23:30:00Z",
  },
  {
    id: "6", title: "Fix auth middleware — session token compliance",
    status: "blocked", priority: "p0", assignedTo: "tom",
    project: "myapp", createdAt: "2026-04-08T10:00:00Z", updatedAt: "2026-04-09T14:00:00Z",
  },
  {
    id: "7", title: "Landing page hero section — video embed",
    status: "open", priority: "p2", assignedTo: "sasha",
    project: "exe-landing-page", createdAt: "2026-04-09T16:00:00Z", updatedAt: "2026-04-09T16:00:00Z",
  },
  {
    id: "8", title: "Config versioning — auto-migration + forward compat",
    status: "done", priority: "p1", assignedTo: "yoshi",
    project: "exe-os", createdAt: "2026-04-09T18:00:00Z", updatedAt: "2026-04-10T00:15:00Z",
  },
];

const REVIEW_TASKS: Task[] = [
  {
    id: "r1", title: "Review: tom — Rebrand exe-wiki frontend",
    status: "open", priority: "p0", assignedTo: "exe",
    project: "exe-wiki", createdAt: "2026-04-10T01:45:00Z", updatedAt: "2026-04-10T01:45:00Z",
  },
  {
    id: "r2", title: "Review: yoshi — Config versioning",
    status: "done", priority: "p1", assignedTo: "exe",
    project: "exe-os", createdAt: "2026-04-10T00:20:00Z", updatedAt: "2026-04-10T00:30:00Z",
  },
];

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
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkView() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return DEMO_TASKS.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [statusFilter, priorityFilter]);

  const selected = useMemo(
    () => [...DEMO_TASKS, ...REVIEW_TASKS].find((t) => t.id === selectedId) ?? null,
    [selectedId],
  );

  const counts = useMemo(() => ({
    total: DEMO_TASKS.length,
    inProgress: DEMO_TASKS.filter((t) => t.status === "in_progress").length,
    blocked: DEMO_TASKS.filter((t) => t.status === "blocked").length,
    done: DEMO_TASKS.filter((t) => t.status === "done").length,
  }), []);

  return (
    <div style={s.container}>
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
          {REVIEW_TASKS.filter((t) => t.status === "open").map((task) => (
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
    </div>
  );
}
