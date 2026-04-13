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
