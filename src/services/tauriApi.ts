/**
 * Tauri IPC wrapper — typed invoke calls for exe-os Rust commands.
 *
 * Each function calls a Tauri command registered in src-tauri/src/lib.rs.
 * Commands return JSON strings; this module parses them into typed objects.
 *
 * Only used in production Tauri builds. Dev mode falls back to the
 * Vite API middleware in exeOsData.ts.
 */

import { invoke } from "@tauri-apps/api/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_to: string;
  assigned_by: string;
  project_name: string;
  context: string;
  result: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRow {
  name: string;
  role: string;
  systemPrompt: string;
  createdAt: string;
}

export interface LicenseResult {
  valid: boolean;
  plan: string;
  email: string;
  expiresAt: string | null;
}

export interface MemoryResult {
  id: string;
  text: string;
  score: number;
}

export interface SpawnResult {
  status: string;
  session: string;
}

export interface ProviderRow {
  id: "anthropic" | "opencode" | "gemini" | "openai" | "chutes";
  name: string;
  status: "active" | "configured" | "not_set";
  apiKey: string;
  model: string;
  models: string[];
  priority: number;
  source: "env" | "config" | "none";
}

export interface TaskFilter {
  assignedTo?: string;
  status?: string;
  project?: string;
}

// ---------------------------------------------------------------------------
// IPC calls
// ---------------------------------------------------------------------------

export async function listTasks(filter?: TaskFilter): Promise<TaskRow[]> {
  const json = await invoke<string>("list_tasks", {
    filter: filter ? JSON.stringify(filter) : undefined,
  });
  return JSON.parse(json);
}

export async function listEmployees(): Promise<EmployeeRow[]> {
  const json = await invoke<string>("list_employees");
  return JSON.parse(json);
}

export async function recallMemory(query: string, limit?: number): Promise<MemoryResult[]> {
  const json = await invoke<string>("recall_memory", { query, limit });
  return JSON.parse(json);
}

export async function getConfig(): Promise<Record<string, unknown>> {
  const json = await invoke<string>("get_config");
  return JSON.parse(json);
}

export async function checkLicense(): Promise<LicenseResult> {
  const json = await invoke<string>("check_license");
  return JSON.parse(json);
}

export async function listProviders(): Promise<ProviderRow[]> {
  const json = await invoke<string>("list_providers");
  return JSON.parse(json) as ProviderRow[];
}

/**
 * Launch the exe-crm web app in a native OS WebviewWindow.
 *
 * AGPL boundary: exe-crm is a separate AGPL codebase loaded by URL only.
 * Do NOT replace this call with an iframe, <webview>, or in-React fetch —
 * each would pull third-party origin code into the Tauri process and break
 * the white-label boundary (see src-tauri/src/lib.rs :: open_crm_window).
 */
export async function openCrmWindow(): Promise<void> {
  await invoke<void>("open_crm_window");
}

export async function spawnSession(
  employeeName: string,
  exeSession: string,
  workingDir: string,
): Promise<SpawnResult> {
  const json = await invoke<string>("spawn_session", {
    employeeName,
    exeSession,
    workingDir,
  });
  return JSON.parse(json);
}
