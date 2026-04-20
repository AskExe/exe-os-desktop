/**
 * Data service — loads real exe-os data via Tauri IPC.
 *
 * Architecture:
 *   1. Try Tauri invoke via tauriApi (works when Rust backend is wired up)
 *   2. Try Vite API middleware (dev mode with exe-os installed)
 *   3. Fall back to demo data
 *
 * Each function returns the same shape regardless of source,
 * so views don't care where data comes from.
 */

import {
  DEMO_EMPLOYEES,
  DEMO_TASKS,
  DEMO_REVIEW_TASKS,
  DEMO_PROVIDERS,
  DEMO_WIKI_NODES,
  DEMO_WIKI_EDGES,
  DEMO_WIKI_MEMORIES,
  DEMO_WIKI_WORKTREE,
  type Employee,
  type Task,
  type Provider,
  type WikiNode,
  type WikiEdge,
  type WikiMemory,
  type WikiWorkTreeProject,
} from "./demoData.js";
import * as tauriApi from "./tauriApi.js";

// ---------------------------------------------------------------------------
// Data bridge — tries Tauri invoke first, then Vite API, then demo fallback
// ---------------------------------------------------------------------------

/** Fetch from the Vite dev server API middleware (vite-plugin-exe-api). */
async function apiFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`/api/${endpoint}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export type { Employee };

export interface EmployeesResult {
  employees: Employee[];
  isDemo: boolean;
}

export async function fetchEmployees(): Promise<EmployeesResult> {
  // 1. Try Tauri IPC (production Tauri build)
  try {
    const raw = await tauriApi.listEmployees();
    const employees: Employee[] = raw.map((e) => ({
      name: e.name,
      role: e.role,
      status: "offline" as const,
      memoryCount: 0,
      currentProject: undefined,
      recentTasks: [],
      reportsTo: e.name === "exe" ? undefined
        : e.name === "yoshi" ? "exe"
        : e.name === "mari" || e.name === "sasha" ? "exe"
        : "yoshi",
    }));
    return { employees, isDemo: false };
  } catch { /* Tauri not available */ }

  // 2. Try Vite API middleware (dev mode with exe-os installed)
  try {
    const raw = await apiFetch<Array<{
      name: string; role: string; status: string;
      memoryCount: number; currentTask: string | null;
      recentTasks: string[]; sessionName: string | null;
    }>>("employees");
    if (raw.length > 0) {
      const employees: Employee[] = raw.map((e) => ({
        name: e.name,
        role: e.role,
        status: e.sessionName ? "active" as const : "offline" as const,
        memoryCount: e.memoryCount,
        currentProject: undefined,
        recentTasks: e.recentTasks,
        reportsTo: e.name === "exe" ? undefined
          : e.name === "yoshi" ? "exe"
          : e.name === "mari" || e.name === "sasha" ? "exe"
          : "yoshi",
      }));
      return { employees, isDemo: false };
    }
  } catch { /* API not available */ }

  // 3. Fallback to demo data
  return { employees: DEMO_EMPLOYEES, isDemo: true };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type { Task };

export interface TasksResult {
  tasks: Task[];
  reviewTasks: Task[];
  isDemo: boolean;
}

export async function fetchTasks(): Promise<TasksResult> {
  // 1. Try Tauri IPC
  try {
    const raw = await tauriApi.listTasks();
    const tasks: Task[] = [];
    const reviewTasks: Task[] = [];
    for (const r of raw) {
      const task: Task = {
        id: r.id,
        title: r.title,
        status: r.status as Task["status"],
        priority: r.priority as Task["priority"],
        assignedTo: r.assigned_to,
        project: r.project_name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
      if (r.assigned_to === "exe" || r.status === "needs_review") {
        reviewTasks.push(task);
      } else {
        tasks.push(task);
      }
    }
    return { tasks, reviewTasks, isDemo: false };
  } catch { /* Tauri not available */ }

  // 2. Try Vite API middleware
  try {
    const raw = await apiFetch<Array<{
      id: string; title: string; status: string; priority: string;
      assignedTo: string; project: string; createdAt: string; updatedAt: string;
    }>>("tasks");
    if (raw.length > 0) {
      const tasks: Task[] = [];
      const reviewTasks: Task[] = [];
      for (const r of raw) {
        const task: Task = {
          id: r.id,
          title: r.title,
          status: r.status as Task["status"],
          priority: r.priority as Task["priority"],
          assignedTo: r.assignedTo,
          project: r.project,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
        if (r.assignedTo === "exe" || r.status === "needs_review") {
          reviewTasks.push(task);
        } else {
          tasks.push(task);
        }
      }
      return { tasks, reviewTasks, isDemo: false };
    }
  } catch { /* API not available */ }

  // 3. Fallback to demo data
  return { tasks: DEMO_TASKS, reviewTasks: DEMO_REVIEW_TASKS, isDemo: true };
}

// ---------------------------------------------------------------------------
// Providers / Settings
// ---------------------------------------------------------------------------

export type { Provider };

export interface ProvidersResult {
  providers: Provider[];
  isDemo: boolean;
}

export async function fetchProviders(): Promise<ProvidersResult> {
  // 1. Try Tauri IPC — list_providers shells out to the exe-os CLI, masks
  //    keys at the Node boundary, and returns the ranked catalog.
  try {
    const providers = await tauriApi.listProviders();
    return { providers, isDemo: false };
  } catch { /* Tauri not available — fall through to demo */ }

  // 2. No Vite tier — provider env vars are never surfaced to the browser.
  // 3. Demo fallback preserves identical UI behavior (demo parity invariant).
  return { providers: DEMO_PROVIDERS, isDemo: true };
}

// ---------------------------------------------------------------------------
// License
// ---------------------------------------------------------------------------

export type Plan = "free" | "pro" | "team" | "enterprise";

export interface LicenseInfo {
  valid: boolean;
  plan: Plan;
  email: string;
  expiresAt: string | null;
}

const FALLBACK_LICENSE: LicenseInfo = {
  valid: true,
  plan: "free",
  email: "",
  expiresAt: null,
};

export interface LicenseResult {
  license: LicenseInfo;
  isDemo: boolean;
}

export async function fetchLicense(): Promise<LicenseResult> {
  // 1. Try Tauri IPC (production Tauri build)
  try {
    const raw = await tauriApi.checkLicense();
    const license: LicenseInfo = {
      valid: raw.valid,
      plan: raw.plan as Plan,
      email: raw.email,
      expiresAt: raw.expiresAt,
    };
    return { license, isDemo: false };
  } catch { /* Tauri not available */ }

  // 2. Try Vite API middleware (dev mode with exe-os installed)
  try {
    const license = await apiFetch<LicenseInfo>("license");
    return { license, isDemo: false };
  } catch { /* API not available */ }

  // 3. Fallback — allow through (user-first)
  return { license: FALLBACK_LICENSE, isDemo: true };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface AppConfig {
  searchMode: string;
  autoIngestion: boolean;
  autoRetrieval: boolean;
  splashEffect: boolean;
  cloudSync: boolean;
  licenseKey: string;
  licenseStatus: string;
  licensePlan: string;
  licenseExpiry: string;
  devicesLinked: number;
  lastSync: string;
}

const DEFAULT_CONFIG: AppConfig = {
  searchMode: "hybrid",
  autoIngestion: true,
  autoRetrieval: true,
  splashEffect: true,
  cloudSync: false,
  licenseKey: "EXE-PRO-•••••••••-4F2A",
  licenseStatus: "ACTIVE",
  licensePlan: "Pro",
  licenseExpiry: "30 days remaining",
  devicesLinked: 1,
  lastSync: "Never",
};

export interface ConfigResult {
  config: AppConfig;
  isDemo: boolean;
}

export async function fetchConfig(): Promise<ConfigResult> {
  // 1. Try Tauri IPC
  try {
    const raw = await tauriApi.getConfig();
    const config: AppConfig = {
      searchMode: String(raw.searchMode ?? "hybrid"),
      autoIngestion: raw.autoIngestion !== false,
      autoRetrieval: raw.autoRetrieval !== false,
      splashEffect: raw.splashEffect !== false,
      cloudSync: false,
      licenseKey: DEFAULT_CONFIG.licenseKey,
      licenseStatus: DEFAULT_CONFIG.licenseStatus,
      licensePlan: DEFAULT_CONFIG.licensePlan,
      licenseExpiry: DEFAULT_CONFIG.licenseExpiry,
      devicesLinked: 1,
      lastSync: "Never",
    };
    return { config, isDemo: false };
  } catch { /* Tauri not available */ }

  // 2. Try Vite API middleware
  try {
    const raw = await apiFetch<Record<string, unknown>>("config");
    if (raw && Object.keys(raw).length > 0) {
      const license = raw.license as Record<string, unknown> | null;
      const cloud = raw.cloud as Record<string, unknown> | null;
      const config: AppConfig = {
        searchMode: String(raw.searchMode ?? "hybrid"),
        autoIngestion: raw.autoIngestion !== false,
        autoRetrieval: raw.autoRetrieval !== false,
        splashEffect: raw.splashEffect !== false,
        cloudSync: !!cloud?.enabled,
        licenseKey: license?.key ? String(license.key) : DEFAULT_CONFIG.licenseKey,
        licenseStatus: license?.status ? String(license.status) : DEFAULT_CONFIG.licenseStatus,
        licensePlan: license?.plan ? String(license.plan) : DEFAULT_CONFIG.licensePlan,
        licenseExpiry: license?.expiresAt ? String(license.expiresAt) : DEFAULT_CONFIG.licenseExpiry,
        devicesLinked: Number(cloud?.devices ?? 1),
        lastSync: cloud?.lastSync ? String(cloud.lastSync) : "Never",
      };
      return { config, isDemo: false };
    }
  } catch { /* API not available */ }

  // 3. Fallback to demo defaults
  return { config: DEFAULT_CONFIG, isDemo: true };
}

// ---------------------------------------------------------------------------
// Config — Save
// ---------------------------------------------------------------------------

export async function saveConfig(updates: Partial<AppConfig>): Promise<void> {
  // 1. Try Tauri IPC
  try {
    await tauriApi.saveDesktopConfig(updates as Record<string, unknown>);
    return;
  } catch { /* Tauri not available */ }

  // 2. Try Vite API middleware
  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) return;
  } catch { /* API not available */ }

  // 3. Demo mode — no-op (toggles still work in-session)
}

// ---------------------------------------------------------------------------
// Wiki — Knowledge Graph
// ---------------------------------------------------------------------------

export type { WikiNode, WikiEdge, WikiMemory, WikiWorkTreeProject };

/** Map a raw entity type string to the WikiNode type union. */
function toNodeType(type: string): WikiNode["type"] {
  const valid = new Set(["person", "project", "concept", "tool", "decision"]);
  return valid.has(type) ? type as WikiNode["type"] : "concept";
}

export interface WikiGraphResult {
  nodes: WikiNode[];
  edges: WikiEdge[];
  worktree: WikiWorkTreeProject[];
  isDemo: boolean;
}

export async function fetchWikiGraph(): Promise<WikiGraphResult> {
  // 1. Try Tauri IPC
  try {
    const raw = await tauriApi.queryGraph();
    if (raw.entities.length > 0) {
      // Count relationships per entity to compute degree
      const degreeCounts = new Map<string, number>();
      for (const r of raw.relationships) {
        degreeCounts.set(r.source_entity_id, (degreeCounts.get(r.source_entity_id) ?? 0) + 1);
        degreeCounts.set(r.target_entity_id, (degreeCounts.get(r.target_entity_id) ?? 0) + 1);
      }

      const nodes: WikiNode[] = raw.entities.map((e) => ({
        id: e.id,
        label: e.name,
        type: toNodeType(e.type),
        degree: degreeCounts.get(e.id) ?? 0,
      }));

      const edges: WikiEdge[] = raw.relationships.map((r) => ({
        from: r.source_entity_id,
        to: r.target_entity_id,
        label: r.type,
        weight: r.weight,
        confidence: r.confidence,
      }));

      // Build worktree from person→project relationships
      const worktree = buildWorktree(raw.entities, raw.relationships);

      return { nodes, edges, worktree, isDemo: false };
    }
  } catch { /* Tauri not available */ }

  // 2. Try Vite API middleware
  try {
    const raw = await apiFetch<{
      entities: Array<{ id: string; name: string; type: string; first_seen: string; last_seen: string }>;
      relationships: Array<{
        source_entity_id: string; target_entity_id: string;
        source_name: string; target_name: string;
        type: string; weight: number; confidence: number;
      }>;
    }>("wiki-graph");
    if (raw.entities.length > 0) {
      const degreeCounts = new Map<string, number>();
      for (const r of raw.relationships) {
        degreeCounts.set(r.source_entity_id, (degreeCounts.get(r.source_entity_id) ?? 0) + 1);
        degreeCounts.set(r.target_entity_id, (degreeCounts.get(r.target_entity_id) ?? 0) + 1);
      }

      const nodes: WikiNode[] = raw.entities.map((e) => ({
        id: e.id,
        label: e.name,
        type: toNodeType(e.type),
        degree: degreeCounts.get(e.id) ?? 0,
      }));

      const edges: WikiEdge[] = raw.relationships.map((r) => ({
        from: r.source_entity_id,
        to: r.target_entity_id,
        label: r.type,
        weight: r.weight,
        confidence: r.confidence,
      }));

      const worktree = buildWorktreeFromApi(raw.entities, raw.relationships);
      return { nodes, edges, worktree, isDemo: false };
    }
  } catch { /* API not available */ }

  // 3. Fallback to demo data
  return {
    nodes: DEMO_WIKI_NODES,
    edges: DEMO_WIKI_EDGES,
    worktree: DEMO_WIKI_WORKTREE,
    isDemo: true,
  };
}

/** Build worktree from Tauri IPC entity/relationship data. */
function buildWorktree(
  entities: tauriApi.GraphEntity[],
  relationships: tauriApi.GraphRelationship[],
): WikiWorkTreeProject[] {
  const projects = entities.filter((e) => e.type === "project");
  const persons = new Set(entities.filter((e) => e.type === "person").map((e) => e.id));
  const concepts = new Map(entities.map((e) => [e.id, e.name]));

  return projects.map((proj) => {
    // Find persons connected to this project
    const agentIds = new Set<string>();
    for (const r of relationships) {
      if (r.target_entity_id === proj.id && persons.has(r.source_entity_id)) agentIds.add(r.source_entity_id);
      if (r.source_entity_id === proj.id && persons.has(r.target_entity_id)) agentIds.add(r.target_entity_id);
    }

    const agents = [...agentIds].map((agentId) => {
      const agent = entities.find((e) => e.id === agentId)!;
      // Find topics this agent is connected to (non-person, non-project)
      const topics: string[] = [];
      for (const r of relationships) {
        const otherId = r.source_entity_id === agentId ? r.target_entity_id : r.source_entity_id;
        if ((r.source_entity_id === agentId || r.target_entity_id === agentId) &&
            !persons.has(otherId) && otherId !== proj.id) {
          const name = concepts.get(otherId);
          if (name && !topics.includes(name)) topics.push(name);
        }
      }
      return { name: agent.name, topics: topics.slice(0, 5) };
    });

    return { project: proj.name, agents };
  }).filter((p) => p.agents.length > 0);
}

/** Build worktree from Vite API response (same shape, different source types). */
function buildWorktreeFromApi(
  entities: Array<{ id: string; name: string; type: string }>,
  relationships: Array<{ source_entity_id: string; target_entity_id: string; source_name: string; target_name: string; type: string }>,
): WikiWorkTreeProject[] {
  const projects = entities.filter((e) => e.type === "project");
  const persons = new Set(entities.filter((e) => e.type === "person").map((e) => e.id));
  const concepts = new Map(entities.map((e) => [e.id, e.name]));

  return projects.map((proj) => {
    const agentIds = new Set<string>();
    for (const r of relationships) {
      if (r.target_entity_id === proj.id && persons.has(r.source_entity_id)) agentIds.add(r.source_entity_id);
      if (r.source_entity_id === proj.id && persons.has(r.target_entity_id)) agentIds.add(r.target_entity_id);
    }

    const agents = [...agentIds].map((agentId) => {
      const agent = entities.find((e) => e.id === agentId)!;
      const topics: string[] = [];
      for (const r of relationships) {
        const otherId = r.source_entity_id === agentId ? r.target_entity_id : r.source_entity_id;
        if ((r.source_entity_id === agentId || r.target_entity_id === agentId) &&
            !persons.has(otherId) && otherId !== proj.id) {
          const name = concepts.get(otherId);
          if (name && !topics.includes(name)) topics.push(name);
        }
      }
      return { name: agent.name, topics: topics.slice(0, 5) };
    });

    return { project: proj.name, agents };
  }).filter((p) => p.agents.length > 0);
}

// ---------------------------------------------------------------------------
// Wiki — Memory Search
// ---------------------------------------------------------------------------

export interface WikiMemoriesResult {
  memories: WikiMemory[];
  isDemo: boolean;
}

export async function fetchWikiMemories(query: string): Promise<WikiMemoriesResult> {
  if (!query.trim()) return { memories: [], isDemo: false };

  // 1. Try Tauri IPC (existing recall_memory command)
  try {
    const raw = await tauriApi.recallMemory(query, 20);
    if (raw.length > 0) {
      const memories: WikiMemory[] = raw.map((r) => ({
        text: r.text,
        agent: "",
        project: "",
        timestamp: "",
        confidence: r.score,
      }));
      return { memories, isDemo: false };
    }
  } catch { /* Tauri not available */ }

  // 2. Try Vite API middleware
  try {
    const raw = await apiFetch<Array<{
      text: string; agent: string; project: string;
      timestamp: string; confidence: number;
    }>>(`wiki-memories?q=${encodeURIComponent(query)}`);
    if (raw.length > 0) {
      return { memories: raw, isDemo: false };
    }
  } catch { /* API not available */ }

  // 3. Fallback to demo data — match against keys
  const q = query.toLowerCase();
  for (const [key, memories] of Object.entries(DEMO_WIKI_MEMORIES)) {
    if (q.includes(key)) return { memories, isDemo: true };
  }
  return { memories: [], isDemo: true };
}
