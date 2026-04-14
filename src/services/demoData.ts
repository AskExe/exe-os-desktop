/**
 * Demo / fallback data for when exe-os data is unavailable.
 *
 * Used by exeOsData.ts as the graceful fallback when Tauri IPC
 * or filesystem reads fail (e.g. Vite dev, exe-os not installed).
 */

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export interface Employee {
  name: string;
  role: string;
  status: "active" | "working" | "idle" | "offline";
  memoryCount: number;
  currentProject?: string;
  recentTasks: string[];
  reportsTo?: string;
}

export const DEMO_EMPLOYEES: Employee[] = [
  {
    name: "exe", role: "COO", status: "active", memoryCount: 1240,
    currentProject: "exe-os",
    recentTasks: ["Review: tom — Rebrand exe-wiki", "Dispatch parallel tasks to tom", "Status brief for founder"],
  },
  {
    name: "yoshi", role: "CTO", status: "working", memoryCount: 3820,
    currentProject: "exe-os",
    recentTasks: ["Config versioning — auto-migration", "Harness boundary CI test", "Confidence scoring on memory facts"],
    reportsTo: "exe",
  },
  {
    name: "tom", role: "Principal Engineer", status: "working", memoryCount: 2150,
    currentProject: "exe-os-desktop",
    recentTasks: ["Desktop Work tab — task dashboard", "Wire agent loop into TUI", "PostCompact + InstructionsLoaded hooks"],
    reportsTo: "yoshi",
  },
  {
    name: "mari", role: "CMO", status: "idle", memoryCount: 680,
    currentProject: undefined,
    recentTasks: ["Brand audit — exe-wiki colors", "SEO content strategy draft"],
    reportsTo: "exe",
  },
  {
    name: "sasha", role: "Content Specialist", status: "offline", memoryCount: 310,
    currentProject: undefined,
    recentTasks: ["Landing page hero B-roll", "Product demo video script"],
    reportsTo: "exe",
  },
];

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface Task {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done" | "blocked";
  priority: "p0" | "p1" | "p2";
  assignedTo: string;
  project: string;
  createdAt: string;
  updatedAt: string;
}

export const DEMO_TASKS: Task[] = [
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

export const DEMO_REVIEW_TASKS: Task[] = [
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
// Providers (Settings)
// ---------------------------------------------------------------------------

/**
 * Provider — single source of truth shared by demo data and the Tauri
 * `list_providers` IPC command output. Shape must match
 * `exe-os/src/bin/list-providers.ts:Provider` byte-for-byte so that the
 * Settings tab renders identically in real and demo modes (demo parity
 * invariant).
 */
export interface Provider {
  id: "anthropic" | "opencode" | "gemini" | "openai" | "chutes";
  name: string;
  status: "active" | "configured" | "not_set";
  apiKey: string;
  model: string;
  models: string[];
  priority: number;
  source: "env" | "config" | "none";
}

export const DEMO_PROVIDERS: Provider[] = [
  { id: "anthropic", name: "Anthropic", status: "active", apiKey: "sk-a****8f20", model: "claude-sonnet-4-20250514", models: ["claude-opus-4-6-20250610", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"], priority: 1, source: "env" },
  { id: "opencode", name: "OpenCode", status: "configured", apiKey: "oc-a****4a10", model: "claude-sonnet-4-20250514", models: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"], priority: 2, source: "env" },
  { id: "gemini", name: "Gemini", status: "not_set", apiKey: "", model: "", models: ["gemini-2.0-flash", "gemini-2.5-pro"], priority: 3, source: "none" },
  { id: "openai", name: "OpenAI", status: "not_set", apiKey: "", model: "", models: ["gpt-4o", "gpt-4o-mini"], priority: 4, source: "none" },
  { id: "chutes", name: "Chutes", status: "not_set", apiKey: "", model: "", models: [], priority: 5, source: "none" },
];

// ---------------------------------------------------------------------------
// Wiki — Knowledge Graph
// ---------------------------------------------------------------------------

export interface WikiNode {
  id: string;
  label: string;
  type: "person" | "project" | "concept" | "tool" | "decision";
  degree: number;
  community?: number;
}

export interface WikiEdge {
  from: string;
  to: string;
  label: string;
  weight: number;
  confidence: number;
}

export interface WikiMemory {
  text: string;
  agent: string;
  project: string;
  timestamp: string;
  confidence: number;
}

export interface WikiWorkTreeAgent {
  name: string;
  topics: string[];
}

export interface WikiWorkTreeProject {
  project: string;
  agents: WikiWorkTreeAgent[];
}

export const DEMO_WIKI_WORKTREE: WikiWorkTreeProject[] = [
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

export const DEMO_WIKI_NODES: WikiNode[] = [
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

export const DEMO_WIKI_EDGES: WikiEdge[] = [
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

export const DEMO_WIKI_MEMORIES: Record<string, WikiMemory[]> = {
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
