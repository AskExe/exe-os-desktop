import React, { useState, useEffect, useRef, useCallback } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphNode {
  id: string;
  label: string;
  type: "person" | "project" | "concept" | "tool" | "decision";
  degree: number;
  community?: number;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
  weight: number;
  confidence: number;
}

interface MemorySnippet {
  text: string;
  agent: string;
  project: string;
  timestamp: string;
  confidence: number;
}

interface WorkTreeAgent {
  name: string;
  topics: string[];
}

interface WorkTreeProject {
  project: string;
  agents: WorkTreeAgent[];
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const WORKTREE: WorkTreeProject[] = [
  { project: "exe-os", agents: [
    { name: "yoshi", topics: ["architecture", "GraphRAG", "config versioning", "tmux routing"] },
    { name: "tom", topics: ["TUI chat mode", "hooks parity", "wiki rebrand"] },
    { name: "mari", topics: ["brand audit", "SEO strategy"] },
  ]},
  { project: "exe-wiki", agents: [
    { name: "tom", topics: ["frontend rebrand", "server rebrand"] },
  ]},
  { project: "exe-create", agents: [
    { name: "sasha", topics: ["video pipeline", "B-roll generation"] },
  ]},
];

const DEMO_NODES: GraphNode[] = [
  { id: "yoshi", label: "yoshi", type: "person", degree: 8 },
  { id: "tom", label: "tom", type: "person", degree: 7 },
  { id: "mari", label: "mari", type: "person", degree: 3 },
  { id: "exe", label: "exe", type: "person", degree: 6 },
  { id: "sasha", label: "sasha", type: "person", degree: 2 },
  { id: "exe-os", label: "exe-os", type: "project", degree: 10 },
  { id: "exe-wiki", label: "exe-wiki", type: "project", degree: 5 },
  { id: "exe-create", label: "exe-create", type: "project", degree: 3 },
  { id: "graphrag", label: "GraphRAG", type: "concept", degree: 5 },
  { id: "tui-chat", label: "TUI Chat Mode", type: "concept", degree: 3 },
  { id: "hooks", label: "CC Hooks", type: "concept", degree: 4 },
  { id: "tmux-routing", label: "tmux routing", type: "concept", degree: 4 },
  { id: "sqlcipher", label: "SQLCipher", type: "tool", degree: 3 },
  { id: "vis-js", label: "vis.js", type: "tool", degree: 2 },
  { id: "anthropic-sdk", label: "Anthropic SDK", type: "tool", degree: 3 },
  { id: "remotion", label: "Remotion", type: "tool", degree: 2 },
  { id: "decision-visjs", label: "vis.js over Three.js", type: "decision", degree: 2 },
  { id: "decision-e2ee", label: "E2EE at rest", type: "decision", degree: 2 },
  { id: "foundry-bold", label: "Exe Foundry Bold", type: "concept", degree: 4 },
  { id: "permissions", label: "Permission Presets", type: "concept", degree: 3 },
];

const DEMO_EDGES: GraphEdge[] = [
  { from: "yoshi", to: "graphrag", label: "implemented", weight: 0.9, confidence: 0.95 },
  { from: "yoshi", to: "exe-os", label: "works_on", weight: 0.8, confidence: 1.0 },
  { from: "yoshi", to: "tmux-routing", label: "implemented", weight: 0.7, confidence: 0.9 },
  { from: "yoshi", to: "hooks", label: "designed", weight: 0.6, confidence: 0.85 },
  { from: "yoshi", to: "decision-visjs", label: "decided", weight: 0.5, confidence: 0.9 },
  { from: "tom", to: "tui-chat", label: "implemented", weight: 0.9, confidence: 0.95 },
  { from: "tom", to: "exe-os", label: "works_on", weight: 0.8, confidence: 1.0 },
  { from: "tom", to: "exe-wiki", label: "worked_on", weight: 0.7, confidence: 0.9 },
  { from: "tom", to: "hooks", label: "implemented", weight: 0.8, confidence: 0.95 },
  { from: "tom", to: "permissions", label: "implemented", weight: 0.7, confidence: 0.9 },
  { from: "tom", to: "foundry-bold", label: "applied", weight: 0.6, confidence: 0.85 },
  { from: "mari", to: "foundry-bold", label: "designed", weight: 0.8, confidence: 0.9 },
  { from: "mari", to: "exe-os", label: "works_on", weight: 0.4, confidence: 1.0 },
  { from: "exe", to: "yoshi", label: "manages", weight: 0.5, confidence: 1.0 },
  { from: "exe", to: "tom", label: "manages", weight: 0.5, confidence: 1.0 },
  { from: "exe", to: "mari", label: "manages", weight: 0.5, confidence: 1.0 },
  { from: "exe", to: "sasha", label: "manages", weight: 0.4, confidence: 1.0 },
  { from: "exe-os", to: "sqlcipher", label: "depends_on", weight: 0.7, confidence: 1.0 },
  { from: "exe-os", to: "anthropic-sdk", label: "depends_on", weight: 0.6, confidence: 1.0 },
  { from: "exe-os", to: "graphrag", label: "includes", weight: 0.8, confidence: 0.95 },
  { from: "exe-wiki", to: "foundry-bold", label: "uses", weight: 0.6, confidence: 0.85 },
  { from: "exe-create", to: "remotion", label: "depends_on", weight: 0.8, confidence: 1.0 },
  { from: "sasha", to: "exe-create", label: "works_on", weight: 0.7, confidence: 1.0 },
  { from: "decision-visjs", to: "vis-js", label: "chose", weight: 0.6, confidence: 0.9 },
  { from: "decision-e2ee", to: "sqlcipher", label: "enables", weight: 0.5, confidence: 0.9 },
  { from: "graphrag", to: "decision-visjs", label: "motivated", weight: 0.4, confidence: 0.8 },
  { from: "tui-chat", to: "anthropic-sdk", label: "uses", weight: 0.5, confidence: 0.9 },
  { from: "permissions", to: "exe-os", label: "part_of", weight: 0.5, confidence: 1.0 },
];

const DEMO_MEMORIES: Record<string, MemorySnippet[]> = {
  yoshi: [
    { text: "Implemented confidence scoring on memory facts — 0-1 at ingest, decay, corroboration", agent: "yoshi", project: "exe-os", timestamp: "2026-04-09T23:30:00Z", confidence: 0.95 },
    { text: "Config versioning — version field, auto-migration, forward compat", agent: "yoshi", project: "exe-os", timestamp: "2026-04-10T00:15:00Z", confidence: 0.9 },
  ],
  tom: [
    { text: "Wired agent loop into TUI CommandCenter — Mode 2 chat with read-only tools", agent: "tom", project: "exe-os", timestamp: "2026-04-10T06:12:00Z", confidence: 0.95 },
    { text: "Rebranded exe-wiki frontend — 109 files, Exe Foundry Bold theme applied", agent: "tom", project: "exe-wiki", timestamp: "2026-04-10T01:44:00Z", confidence: 0.9 },
  ],
  graphrag: [
    { text: "GraphRAG entity extraction runs at ingest time, builds knowledge graph in SQLite", agent: "yoshi", project: "exe-os", timestamp: "2026-04-08T14:00:00Z", confidence: 0.85 },
    { text: "Chose vis.js over Three.js for wiki graph — 2D network is clearer for knowledge nav", agent: "yoshi", project: "exe-os", timestamp: "2026-04-07T10:00:00Z", confidence: 0.9 },
  ],
  "exe-os": [
    { text: "Three-layer cognition: ingest → store → retrieve. Five runtime modes.", agent: "yoshi", project: "exe-os", timestamp: "2026-04-05T08:00:00Z", confidence: 0.95 },
    { text: "v2 roadmap: scale (sharding→GraphRAG→IVF) + cloud + quantum-resistant E2EE", agent: "exe", project: "exe-os", timestamp: "2026-04-03T12:00:00Z", confidence: 0.9 },
  ],
};

const CANNED_RESPONSES: Record<string, string> = {
  yoshi: "Yoshi (CTO) has been focused on: GraphRAG confidence scoring, config versioning with auto-migration, and harness boundary CI tests. 3,820 memories across exe-os.",
  tom: "Tom (Principal Engineer) recently completed: TUI chat mode wiring, PostCompact + InstructionsLoaded hooks, exe-wiki full rebrand (249 files), and role-based permission presets.",
  graphrag: "GraphRAG extracts entities and relationships at ingest time into a knowledge graph stored in SQLite. Uses confidence scoring (0-1) with decay and corroboration. Visualization uses vis.js (2D network, not Three.js).",
  "exe-os": "exe-os is the core memory system — three-layer cognition (ingest→store→retrieve), five runtime modes, E2EE at rest via SQLCipher. v2 adds domain sharding, GraphRAG, IVF indexes.",
};

// ---------------------------------------------------------------------------
// Node type colors (Exe Foundry Bold)
// ---------------------------------------------------------------------------

const NODE_COLORS: Record<GraphNode["type"], string> = {
  person: "#F5D76E",
  project: "#dec1ac",
  concept: "#ffb4a8",
  tool: "#e2c55e",
  decision: "#22C55E",
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    gap: 0,
  },
  main: {
    display: "flex",
    flex: 1,
    minHeight: 0,
  },
  workTree: {
    width: 220,
    background: "var(--surface-low)",
    overflow: "auto",
    padding: 8,
    flexShrink: 0,
  },
  graphArea: {
    flex: 1,
    background: "#0e0d19",
    position: "relative" as const,
  },
  detailPanel: {
    width: 280,
    background: "var(--surface-low)",
    overflow: "auto",
    padding: 16,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  chatBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    background: "var(--surface-container)",
  },
  chatInput: {
    flex: 1,
    background: "var(--surface-lowest)",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "8px 12px",
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: "var(--on-surface)",
    outline: "none",
  },
  chatButton: {
    background: "var(--primary-container)",
    border: "none",
    padding: "8px 16px",
    fontFamily: "var(--font-label)",
    fontSize: 12,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "var(--on-primary-container)",
    cursor: "pointer",
  },
  chatResponse: {
    padding: "8px 16px",
    background: "var(--surface-container-high)",
    maxHeight: 200,
    overflow: "auto",
  },
  sectionTitle: {
    fontFamily: "var(--font-headline)",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "var(--outline)",
    padding: "8px 0 4px",
  },
  treeProject: (selected: boolean) => ({
    fontFamily: "var(--font-label)",
    fontSize: 13,
    fontWeight: 700,
    color: selected ? "var(--primary-container)" : "var(--on-surface)",
    padding: "4px 8px",
    cursor: "pointer",
    background: selected ? "var(--surface-high)" : "transparent",
  }),
  treeAgent: (selected: boolean) => ({
    fontFamily: "var(--font-label)",
    fontSize: 12,
    color: selected ? "var(--primary-container)" : "var(--on-surface-variant)",
    padding: "2px 8px 2px 24px",
    cursor: "pointer",
    background: selected ? "var(--surface-high)" : "transparent",
  }),
  treeTopic: (selected: boolean) => ({
    fontFamily: "var(--font-body)",
    fontSize: 11,
    color: selected ? "var(--primary-container)" : "var(--outline)",
    padding: "1px 8px 1px 40px",
    cursor: "pointer",
    background: selected ? "var(--surface-high)" : "transparent",
  }),
  detailHeadline: {
    fontFamily: "var(--font-headline)",
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.02em",
    color: "var(--on-surface)",
  },
  detailBadge: (color: string) => ({
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color,
    padding: "2px 8px",
    background: color + "18",
    display: "inline-block",
  }),
  fieldLabel: {
    fontFamily: "var(--font-label)",
    fontSize: 10,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--outline)",
    marginBottom: 2,
  },
  fieldValue: {
    fontFamily: "var(--font-body)",
    fontSize: 13,
    color: "var(--on-surface)",
  },
  relation: {
    fontFamily: "var(--font-label)",
    fontSize: 12,
    color: "var(--on-surface-variant)",
    padding: "2px 0",
  },
  memoryCard: {
    background: "var(--surface-container)",
    padding: 8,
    marginBottom: 4,
  },
  memoryText: {
    fontFamily: "var(--font-body)",
    fontSize: 12,
    color: "var(--on-surface)",
    lineHeight: "1.4",
  },
  memoryMeta: {
    fontFamily: "var(--font-label)",
    fontSize: 10,
    color: "var(--outline)",
    marginTop: 4,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WikiView() {
  const graphRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatResponse, setChatResponse] = useState<string | null>(null);

  // Initialize vis.js network
  useEffect(() => {
    if (!graphRef.current) return;

    const nodes = new DataSet(
      DEMO_NODES.map((n) => ({
        id: n.id,
        label: n.label,
        color: {
          background: NODE_COLORS[n.type],
          border: NODE_COLORS[n.type],
          highlight: { background: NODE_COLORS[n.type], border: "#fff4dc" },
          hover: { background: NODE_COLORS[n.type], border: "#fff4dc" },
        },
        font: { color: "#0e0d19", face: "Space Grotesk, sans-serif", size: 12 + n.degree },
        size: 10 + n.degree * 2,
        shape: n.type === "person" ? "dot" : n.type === "decision" ? "diamond" : "dot",
        borderWidth: 0,
        borderWidthSelected: 2,
      })),
    );

    const edges = new DataSet(
      DEMO_EDGES.map((e, i) => ({
        id: `e${i}`,
        from: e.from,
        to: e.to,
        label: e.label,
        width: 1 + e.weight * 2,
        color: { color: `rgba(76, 70, 55, ${0.3 + e.confidence * 0.7})`, highlight: "#F5D76E", hover: "#cfc6b1" },
        font: { color: "#98907d", size: 10, face: "Space Grotesk, sans-serif", strokeWidth: 0 },
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        smooth: { type: "continuous" as const },
      })),
    );

    const network = new Network(graphRef.current, { nodes, edges }, {
      physics: {
        solver: "barnesHut",
        barnesHut: { gravitationalConstant: -3000, centralGravity: 0.1, springLength: 120 },
        stabilization: { iterations: 100 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        dragView: true,
      },
      nodes: { borderWidth: 0 },
      edges: { smooth: { type: "continuous" } },
    });

    network.on("click", (params) => {
      if (params.nodes.length > 0) {
        setSelectedNode(params.nodes[0] as string);
      }
    });

    networkRef.current = network;

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, []);

  // Focus graph on a node
  const focusNode = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
    if (networkRef.current) {
      networkRef.current.focus(nodeId, { scale: 1.2, animation: { duration: 500, easingFunction: "easeInOutQuad" } });
      networkRef.current.selectNodes([nodeId]);
    }
  }, []);

  // Chat handler
  const handleChat = useCallback(() => {
    const q = chatInput.trim().toLowerCase();
    if (!q) return;

    let response = `I found ${Math.floor(Math.random() * 15) + 5} memories related to "${chatInput}". Key themes: architecture decisions, implementation patterns, team coordination.`;
    for (const [key, val] of Object.entries(CANNED_RESPONSES)) {
      if (q.includes(key)) { response = val; break; }
    }
    setChatResponse(response);
    setChatInput("");
  }, [chatInput]);

  // Get selected node data
  const nodeData = selectedNode ? DEMO_NODES.find((n) => n.id === selectedNode) : null;
  const nodeEdges = selectedNode ? DEMO_EDGES.filter((e) => e.from === selectedNode || e.to === selectedNode) : [];
  const nodeMemories = selectedNode ? (DEMO_MEMORIES[selectedNode] ?? []) : [];

  return (
    <div style={s.container}>
      <div style={s.main}>
        {/* WorkTree */}
        <div style={s.workTree}>
          <div style={s.sectionTitle}>Knowledge Tree</div>
          {WORKTREE.map((proj) => (
            <div key={proj.project}>
              <div
                style={s.treeProject(selectedNode === proj.project)}
                onClick={() => focusNode(proj.project)}
              >
                {proj.project}
              </div>
              {proj.agents.map((agent) => (
                <div key={`${proj.project}-${agent.name}`}>
                  <div
                    style={s.treeAgent(selectedNode === agent.name)}
                    onClick={() => focusNode(agent.name)}
                  >
                    {agent.name}
                  </div>
                  {agent.topics.map((topic) => {
                    const topicId = DEMO_NODES.find((n) => n.label.toLowerCase() === topic.toLowerCase())?.id;
                    return (
                      <div
                        key={topic}
                        style={s.treeTopic(selectedNode === topicId)}
                        onClick={() => topicId && focusNode(topicId)}
                      >
                        {topic}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Graph */}
        <div style={s.graphArea}>
          <div ref={graphRef} style={{ width: "100%", height: "100%" }} />
        </div>

        {/* Detail Panel */}
        <div style={s.detailPanel}>
          {nodeData ? (
            <>
              <div style={s.detailHeadline}>{nodeData.label}</div>
              <div style={s.detailBadge(NODE_COLORS[nodeData.type])}>{nodeData.type}</div>

              <div>
                <div style={s.fieldLabel}>Connections</div>
                <div style={s.fieldValue}>{nodeData.degree}</div>
              </div>

              {nodeEdges.length > 0 && (
                <div>
                  <div style={s.fieldLabel}>Relationships</div>
                  {nodeEdges.map((e, i) => {
                    const target = e.from === selectedNode ? e.to : e.from;
                    const dir = e.from === selectedNode ? "\u2192" : "\u2190";
                    return (
                      <div key={i} style={s.relation}>
                        {dir} <span style={{ color: "var(--primary-dim)" }}>{e.label}</span> {target}
                      </div>
                    );
                  })}
                </div>
              )}

              {nodeMemories.length > 0 && (
                <div>
                  <div style={s.fieldLabel}>Related Memories</div>
                  {nodeMemories.map((m, i) => (
                    <div key={i} style={s.memoryCard}>
                      <div style={s.memoryText}>{m.text}</div>
                      <div style={s.memoryMeta}>
                        {m.agent} &middot; {m.project} &middot; {(m.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: "var(--outline)", fontFamily: "var(--font-body)", fontSize: 13 }}>
              Click a node in the graph to see details.
            </div>
          )}
        </div>
      </div>

      {/* Chat response */}
      {chatResponse && (
        <div style={s.chatResponse}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--on-surface)" }}>
            {chatResponse}
          </div>
        </div>
      )}

      {/* Chat bar */}
      <div style={s.chatBar}>
        <input
          style={s.chatInput}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleChat()}
          onFocus={(e) => { e.target.style.borderBottomColor = "var(--primary-container)"; }}
          onBlur={(e) => { e.target.style.borderBottomColor = "transparent"; }}
          placeholder="Ask the wiki..."
        />
        <button style={s.chatButton} onClick={handleChat}>Send</button>
      </div>
    </div>
  );
}
