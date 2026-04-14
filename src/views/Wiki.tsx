import { useState, useEffect, useRef, useCallback } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import {
  fetchWikiGraph,
  fetchWikiMemories,
  type WikiNode,
  type WikiEdge,
  type WikiMemory,
  type WikiWorkTreeProject,
} from "../services/exeOsData.js";
import {
  DEMO_WIKI_NODES,
  DEMO_WIKI_EDGES,
  DEMO_WIKI_MEMORIES,
} from "../services/demoData.js";

// ---------------------------------------------------------------------------
// Node type colors (Exe Foundry Bold)
// ---------------------------------------------------------------------------

const NODE_COLORS: Record<WikiNode["type"], string> = {
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
    background: "var(--surface-lowest)",
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

  // Live data state
  const [nodes, setNodes] = useState<WikiNode[]>(DEMO_WIKI_NODES);
  const [edges, setEdges] = useState<WikiEdge[]>(DEMO_WIKI_EDGES);
  const [worktree, setWorktree] = useState<WikiWorkTreeProject[]>([]);
  const [nodeMemories, setNodeMemories] = useState<WikiMemory[]>([]);

  // Load graph data
  useEffect(() => {
    let cancelled = false;
    fetchWikiGraph().then((result) => {
      if (cancelled) return;
      setNodes(result.nodes);
      setEdges(result.edges);
      setWorktree(result.worktree);
    });
    return () => { cancelled = true; };
  }, []);

  // Initialize vis.js network when nodes/edges change
  useEffect(() => {
    if (!graphRef.current) return;

    const visNodes = new DataSet(
      nodes.map((n) => ({
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

    const visEdges = new DataSet(
      edges.map((e, i) => ({
        id: `e${i}`,
        from: e.from,
        to: e.to,
        label: e.label,
        width: 1 + e.weight * 2,
        color: { color: `rgba(76, 70, 55, ${0.3 + e.confidence * 0.7})`, highlight: "#F5D76E", hover: "#cfc6b1" },
        font: { color: "#98907d", size: 10, face: "Space Grotesk, sans-serif", strokeWidth: 0 },
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        smooth: { enabled: true, type: "continuous", roundness: 0.5 },
      })),
    );

    const network = new Network(graphRef.current, { nodes: visNodes, edges: visEdges }, {
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
      edges: { smooth: { enabled: true, type: "continuous", roundness: 0.5 } },
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
  }, [nodes, edges]);

  // Load memories when a node is selected
  useEffect(() => {
    if (!selectedNode) {
      setNodeMemories([]);
      return;
    }

    const nodeData = nodes.find((n) => n.id === selectedNode);
    if (!nodeData) {
      setNodeMemories([]);
      return;
    }

    let cancelled = false;
    fetchWikiMemories(nodeData.label).then((result) => {
      if (cancelled) return;
      if (result.memories.length > 0) {
        setNodeMemories(result.memories);
      } else {
        // Fall back to demo memories for this node
        setNodeMemories(DEMO_WIKI_MEMORIES[selectedNode] ?? []);
      }
    });
    return () => { cancelled = true; };
  }, [selectedNode, nodes]);

  // Focus graph on a node
  const focusNode = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
    if (networkRef.current) {
      networkRef.current.focus(nodeId, { scale: 1.2, animation: { duration: 500, easingFunction: "easeInOutQuad" } });
      networkRef.current.selectNodes([nodeId]);
    }
  }, []);

  // Chat handler — searches memories via service layer
  const handleChat = useCallback(() => {
    const q = chatInput.trim();
    if (!q) return;

    setChatResponse("Searching...");
    setChatInput("");

    fetchWikiMemories(q).then((result) => {
      if (result.memories.length > 0) {
        const summary = result.memories
          .slice(0, 5)
          .map((m) => `- ${m.text}`)
          .join("\n");
        setChatResponse(
          `Found ${result.memories.length} memories${result.isDemo ? " (demo)" : ""}:\n${summary}`,
        );
      } else {
        setChatResponse(`No memories found for "${q}".`);
      }
    });
  }, [chatInput]);

  // Get selected node data for the detail panel
  const nodeData = selectedNode ? nodes.find((n) => n.id === selectedNode) : null;
  const nodeEdges = selectedNode ? edges.filter((e) => e.from === selectedNode || e.to === selectedNode) : [];

  return (
    <div style={s.container}>
      <div style={s.main}>
        {/* WorkTree */}
        <div style={s.workTree}>
          <div style={s.sectionTitle}>Knowledge Tree</div>
          {worktree.map((proj) => (
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
                    const topicNode = nodes.find((n) => n.label.toLowerCase() === topic.toLowerCase());
                    return (
                      <div
                        key={topic}
                        style={s.treeTopic(selectedNode === topicNode?.id)}
                        onClick={() => topicNode && focusNode(topicNode.id)}
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
                    // Resolve target label from nodes if possible
                    const targetNode = nodes.find((n) => n.id === target);
                    const targetLabel = targetNode ? targetNode.label : target;
                    return (
                      <div key={i} style={s.relation}>
                        {dir} <span style={{ color: "var(--primary-dim)" }}>{e.label}</span> {targetLabel}
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
          <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--on-surface)", whiteSpace: "pre-line" }}>
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
