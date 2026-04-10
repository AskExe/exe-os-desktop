import React, { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExternalAgent {
  name: string;
  type: "webhook" | "api" | "mcp";
  status: "connected" | "degraded" | "offline";
  lastSeen: string;
  capabilities: string[];
  endpoint?: string;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const DEMO_AGENTS: ExternalAgent[] = [
  {
    name: "GitHub Actions",
    type: "webhook",
    status: "connected",
    lastSeen: "2026-04-10T06:30:00Z",
    capabilities: ["CI/CD triggers", "PR status updates", "Deployment notifications"],
    endpoint: "https://api.github.com/repos/exe-ai/exe-os",
  },
  {
    name: "Linear Webhook",
    type: "webhook",
    status: "connected",
    lastSeen: "2026-04-10T06:28:00Z",
    capabilities: ["Issue sync", "Status updates", "Label routing"],
    endpoint: "https://api.linear.app/webhooks",
  },
  {
    name: "Slack Integration",
    type: "api",
    status: "degraded",
    lastSeen: "2026-04-10T05:15:00Z",
    capabilities: ["Channel notifications", "Thread replies", "File uploads"],
    endpoint: "https://hooks.slack.com/services/T00/B00/xxx",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<ExternalAgent["status"], string> = {
  connected: "#22C55E",
  degraded: "#F5D76E",
  offline: "#4c4637",
};

const STATUS_LABEL: Record<ExternalAgent["status"], string> = {
  connected: "CONNECTED",
  degraded: "DEGRADED",
  offline: "OFFLINE",
};

const TYPE_COLOR: Record<ExternalAgent["type"], string> = {
  webhook: "#dec1ac",
  api: "#F5D76E",
  mcp: "#ffb4a8",
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
  contentArea: {
    display: "flex",
    gap: 8,
    flex: 1,
    minHeight: 0,
  },
  agentList: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    flexDirection: "column" as const,
  },
  agentRow: (selected: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "12px 16px",
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
  agentName: {
    flex: 1,
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: "var(--on-surface)",
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
  timeLabel: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    color: "var(--outline-variant)",
    width: 70,
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
  fieldLabel: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--outline)",
  },
  fieldValue: {
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: "var(--on-surface)",
  },
  formSection: {
    background: "var(--surface-low)",
    padding: 24,
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  input: {
    background: "var(--surface-container)",
    border: "none",
    padding: "8px 12px",
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: "var(--on-surface)",
    outline: "none",
    width: "100%",
  },
  button: {
    background: "var(--primary-container)",
    border: "none",
    padding: "8px 16px",
    fontFamily: "var(--font-label)",
    fontSize: 12,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "var(--on-primary-container)",
    cursor: "pointer",
    alignSelf: "flex-start" as const,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExternalView() {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected = DEMO_AGENTS.find((a) => a.name === selectedName) ?? null;

  const connectedCount = DEMO_AGENTS.filter((a) => a.status === "connected").length;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.sectionTitle}>
          {DEMO_AGENTS.length} External Agents &middot; {connectedCount} connected
        </div>
      </div>

      <div style={s.contentArea}>
        {/* Agent list */}
        <div style={s.agentList}>
          {DEMO_AGENTS.map((agent) => (
            <div
              key={agent.name}
              style={s.agentRow(selectedName === agent.name)}
              onClick={() => setSelectedName(agent.name)}
            >
              <div style={s.dot(STATUS_DOT[agent.status])} />
              <div style={s.agentName}>{agent.name}</div>
              <div style={s.badge(TYPE_COLOR[agent.type])}>{agent.type.toUpperCase()}</div>
              <div style={s.timeLabel}>{timeAgo(agent.lastSeen)}</div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={s.detailPanel}>
            <div style={s.detailHeadline}>{selected.name}</div>
            <div>
              <div style={s.fieldLabel}>Status</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={s.dot(STATUS_DOT[selected.status])} />
                <span style={s.fieldValue}>{STATUS_LABEL[selected.status]}</span>
              </div>
            </div>
            <div>
              <div style={s.fieldLabel}>Type</div>
              <div style={s.badge(TYPE_COLOR[selected.type])}>{selected.type.toUpperCase()}</div>
            </div>
            {selected.endpoint && (
              <div>
                <div style={s.fieldLabel}>Endpoint</div>
                <div style={{ ...s.fieldValue, fontSize: 12, wordBreak: "break-all" as const }}>{selected.endpoint}</div>
              </div>
            )}
            <div>
              <div style={s.fieldLabel}>Last Seen</div>
              <div style={s.fieldValue}>{timeAgo(selected.lastSeen)}</div>
            </div>
            <div>
              <div style={s.fieldLabel}>Capabilities</div>
              {selected.capabilities.map((cap, i) => (
                <div key={i} style={{ ...s.fieldValue, fontSize: 13, color: "var(--on-surface-variant)", padding: "2px 0" }}>
                  &bull; {cap}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add agent form */}
      <div style={s.formSection}>
        <div style={s.sectionTitle}>Add External Agent</div>
        <input style={s.input} placeholder="Agent name" readOnly />
        <input style={s.input} placeholder="Endpoint URL" readOnly />
        <select style={{ ...s.input, cursor: "pointer" }} disabled>
          <option>webhook</option>
          <option>api</option>
          <option>mcp</option>
        </select>
        <button style={s.button}>Connect Agent</button>
      </div>
    </div>
  );
}
