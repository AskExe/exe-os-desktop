import { useEffect, useState } from "react";
import { fetchEmployees, type Employee } from "../services/exeOsData.js";

// ---------------------------------------------------------------------------
// External Agent types & data (merged from External.tsx)
// ---------------------------------------------------------------------------

interface ExternalAgent {
  name: string;
  type: "webhook" | "api" | "mcp";
  status: "connected" | "degraded" | "offline";
  lastSeen: string;
  capabilities: string[];
  endpoint?: string;
}

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

const EXT_STATUS_DOT: Record<ExternalAgent["status"], string> = {
  connected: "#22C55E",
  degraded: "#F5D76E",
  offline: "#4c4637",
};

const EXT_STATUS_LABEL: Record<ExternalAgent["status"], string> = {
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
// Helpers
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<Employee["status"], string> = {
  active: "#22C55E",
  working: "#F5D76E",
  idle: "#98907d",
  offline: "#4c4637",
};

const STATUS_LABEL: Record<Employee["status"], string> = {
  active: "ACTIVE",
  working: "WORKING",
  idle: "IDLE",
  offline: "OFFLINE",
};

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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 8,
  },
  card: (selected: boolean) => ({
    padding: 16,
    background: selected ? "var(--surface-high)" : "var(--surface-low)",
    cursor: "pointer",
    transition: "background 0.15s",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  }),
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  dot: (color: string) => ({
    width: 8,
    height: 8,
    background: color,
    flexShrink: 0,
  }),
  name: {
    fontFamily: "var(--font-headline)",
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "var(--on-surface)",
  },
  role: {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    color: "var(--outline)",
    letterSpacing: "0.04em",
  },
  meta: {
    fontFamily: "var(--font-label)",
    fontSize: 12,
    color: "var(--outline)",
  },
  sectionTitle: {
    fontFamily: "var(--font-headline)",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "var(--outline)",
  },
  detailPanel: {
    background: "var(--surface-low)",
    padding: 24,
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
  orgRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 0",
  },
  orgArrow: {
    fontFamily: "var(--font-label)",
    fontSize: 12,
    color: "var(--outline-variant)",
  },
  orgName: {
    fontFamily: "var(--font-label)",
    fontSize: 12,
    color: "var(--on-surface)",
  },
  extRow: (selected: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "12px 16px",
    background: selected ? "var(--surface-high)" : "transparent",
    cursor: "pointer",
    transition: "background 0.1s",
  }),
  extName: {
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
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamView() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployees().then(({ employees: e }) => setEmployees(e));
  }, []);

  const selected = employees.find((e) => e.name === selectedName) ?? null;
  const selectedExt = DEMO_AGENTS.find((a) => a.name === selectedAgent) ?? null;
  const connectedCount = DEMO_AGENTS.filter((a) => a.status === "connected").length;

  return (
    <div style={s.container}>
      {/* ---- Internal section ---- */}
      <div style={s.sectionTitle}>
        Internal &middot; {employees.length} Employees
      </div>

      <div style={{ display: "flex", gap: 8, flex: 1, minHeight: 0 }}>
        {/* Left: cards grid */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={s.grid}>
            {employees.map((emp) => (
              <div
                key={emp.name}
                style={s.card(selectedName === emp.name)}
                onClick={() => { setSelectedName(emp.name); setSelectedAgent(null); }}
              >
                <div style={s.cardHeader}>
                  <div style={s.dot(STATUS_DOT[emp.status])} />
                  <span style={s.name}>{emp.name}</span>
                </div>
                <div style={s.role}>{emp.role}</div>
                <div style={s.meta}>
                  {emp.memoryCount.toLocaleString()} memories
                  {emp.currentProject && <> &middot; {emp.currentProject}</>}
                </div>
                <div style={{ ...s.meta, color: STATUS_DOT[emp.status] }}>
                  {STATUS_LABEL[emp.status]}
                </div>
              </div>
            ))}
          </div>

          {/* Org chart */}
          <div style={{ marginTop: 24 }}>
            <div style={s.sectionTitle}>Organization</div>
            <div style={{ marginTop: 8, padding: "0 8px" }}>
              <div style={s.orgRow}>
                <span style={{ ...s.orgName, color: "var(--primary-container)" }}>exe</span>
                <span style={s.orgArrow}>(COO)</span>
              </div>
              <div style={{ paddingLeft: 24 }}>
                <div style={s.orgRow}>
                  <span style={s.orgArrow}>&rarr;</span>
                  <span style={s.orgName}>yoshi</span>
                  <span style={s.orgArrow}>(CTO)</span>
                </div>
                <div style={{ paddingLeft: 24 }}>
                  <div style={s.orgRow}>
                    <span style={s.orgArrow}>&rarr;</span>
                    <span style={s.orgName}>tom</span>
                    <span style={s.orgArrow}>(Principal Engineer)</span>
                  </div>
                </div>
                <div style={s.orgRow}>
                  <span style={s.orgArrow}>&rarr;</span>
                  <span style={s.orgName}>mari</span>
                  <span style={s.orgArrow}>(CMO)</span>
                </div>
                <div style={s.orgRow}>
                  <span style={s.orgArrow}>&rarr;</span>
                  <span style={s.orgName}>sasha</span>
                  <span style={s.orgArrow}>(Content Specialist)</span>
                </div>
              </div>
            </div>
          </div>

          {/* ---- External section ---- */}
          <div style={{ marginTop: 32 }}>
            <div style={s.sectionTitle}>
              External &middot; {DEMO_AGENTS.length} Agents &middot; {connectedCount} connected
            </div>
            <div style={{ marginTop: 8 }}>
              {DEMO_AGENTS.map((agent) => (
                <div
                  key={agent.name}
                  style={s.extRow(selectedAgent === agent.name)}
                  onClick={() => { setSelectedAgent(agent.name); setSelectedName(null); }}
                >
                  <div style={s.dot(EXT_STATUS_DOT[agent.status])} />
                  <div style={s.extName}>{agent.name}</div>
                  <div style={s.badge(TYPE_COLOR[agent.type])}>{agent.type.toUpperCase()}</div>
                  <div style={s.timeLabel}>{timeAgo(agent.lastSeen)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: detail panel — employee */}
        {selected && (
          <div style={{ ...s.detailPanel, width: 300 }}>
            <div style={s.detailHeadline}>{selected.name}</div>
            <div>
              <div style={s.fieldLabel}>Role</div>
              <div style={s.fieldValue}>{selected.role}</div>
            </div>
            <div>
              <div style={s.fieldLabel}>Status</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={s.dot(STATUS_DOT[selected.status])} />
                <span style={s.fieldValue}>{STATUS_LABEL[selected.status]}</span>
              </div>
            </div>
            <div>
              <div style={s.fieldLabel}>Memories</div>
              <div style={s.fieldValue}>{selected.memoryCount.toLocaleString()}</div>
            </div>
            {selected.currentProject && (
              <div>
                <div style={s.fieldLabel}>Current Project</div>
                <div style={s.fieldValue}>{selected.currentProject}</div>
              </div>
            )}
            {selected.reportsTo && (
              <div>
                <div style={s.fieldLabel}>Reports To</div>
                <div style={s.fieldValue}>{selected.reportsTo}</div>
              </div>
            )}
            <div>
              <div style={s.fieldLabel}>Recent Tasks</div>
              {selected.recentTasks.map((t, i) => (
                <div key={i} style={{ ...s.fieldValue, fontSize: 13, color: "var(--on-surface-variant)", padding: "2px 0" }}>
                  &bull; {t}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right: detail panel — external agent */}
        {selectedExt && (
          <div style={{ ...s.detailPanel, width: 300 }}>
            <div style={s.detailHeadline}>{selectedExt.name}</div>
            <div>
              <div style={s.fieldLabel}>Status</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={s.dot(EXT_STATUS_DOT[selectedExt.status])} />
                <span style={s.fieldValue}>{EXT_STATUS_LABEL[selectedExt.status]}</span>
              </div>
            </div>
            <div>
              <div style={s.fieldLabel}>Type</div>
              <div style={s.badge(TYPE_COLOR[selectedExt.type])}>{selectedExt.type.toUpperCase()}</div>
            </div>
            {selectedExt.endpoint && (
              <div>
                <div style={s.fieldLabel}>Endpoint</div>
                <div style={{ ...s.fieldValue, fontSize: 12, wordBreak: "break-all" as const }}>{selectedExt.endpoint}</div>
              </div>
            )}
            <div>
              <div style={s.fieldLabel}>Last Seen</div>
              <div style={s.fieldValue}>{timeAgo(selectedExt.lastSeen)}</div>
            </div>
            <div>
              <div style={s.fieldLabel}>Capabilities</div>
              {selectedExt.capabilities.map((cap, i) => (
                <div key={i} style={{ ...s.fieldValue, fontSize: 13, color: "var(--on-surface-variant)", padding: "2px 0" }}>
                  &bull; {cap}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
