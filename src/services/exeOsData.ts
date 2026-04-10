/**
 * Data service — loads real exe-os data via Tauri IPC.
 *
 * Architecture:
 *   1. Try Tauri invoke (works when Rust backend is wired up)
 *   2. Fall back to demo data (Vite dev mode / exe-os not installed)
 *
 * Each function returns the same shape regardless of source,
 * so views don't care where data comes from.
 */

import {
  DEMO_EMPLOYEES,
  DEMO_TASKS,
  DEMO_REVIEW_TASKS,
  DEMO_PROVIDERS,
  type Employee,
  type Task,
  type Provider,
} from "./demoData.js";

// ---------------------------------------------------------------------------
// Data bridge — tries Tauri invoke first, then Vite API, then demo fallback
// ---------------------------------------------------------------------------

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

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
    const employees = await tauriInvoke<Employee[]>("get_employees");
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
    const data = await tauriInvoke<{ tasks: Task[]; reviewTasks: Task[] }>("get_tasks");
    return { ...data, isDemo: false };
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
  // 1. Try Tauri IPC
  try {
    const providers = await tauriInvoke<Provider[]>("get_providers");
    return { providers, isDemo: false };
  } catch { /* Tauri not available */ }

  // 2. Providers not exposed via Vite API (requires env var access)
  // Fall through to demo data
  return { providers: DEMO_PROVIDERS, isDemo: true };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface AppConfig {
  searchMode: string;
  autoIngestion: boolean;
  autoRetrieval: boolean;
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
    const config = await tauriInvoke<AppConfig>("get_config");
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
