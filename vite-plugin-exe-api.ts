/**
 * Vite plugin that serves exe-os data as local API endpoints during dev.
 *
 * Routes:
 *   GET /api/tasks     — all tasks from exe-os DB
 *   GET /api/employees — employee roster + memory counts + current tasks
 *   GET /api/config    — exe-os config from ~/.exe-os/config.json
 *   GET /api/license   — license validation via exe-os checkLicense()
 *
 * When Tauri IPC is available, the frontend will use invoke() instead
 * and this plugin becomes unnecessary.
 *
 * NOTE: exe-os imports use resolved filesystem paths (not package specifiers)
 * to avoid Vite's externalize-deps resolver failing on unexported subpaths.
 */

import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API_PREFIX = "/api/";
const HOME = homedir();
const EXE_OS_CONFIG_DIR = join(HOME, ".exe-os");

/** Resolve exe-os dist path from the linked dependency (not global). */
function resolveExeOs(): string {
  try {
    // exe-os is linked via file:../exe-os in package.json
    const pkgPath = join(__dirname, "node_modules", "exe-os", "dist");
    if (existsSync(pkgPath)) return pkgPath;
  } catch { /* fall through */ }
  try {
    // Fallback: global install
    const globalRoot = execSync("npm root -g", { encoding: "utf8", timeout: 3000 }).trim();
    return join(globalRoot, "exe-os", "dist");
  } catch { /* fall through */ }
  return "";
}

let _exeOsPath: string | null = null;
function getExeOsPath(): string {
  if (_exeOsPath === null) _exeOsPath = resolveExeOs();
  return _exeOsPath;
}

export default function exeApiPlugin(): Plugin {
  return {
    name: "exe-os-api",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith(API_PREFIX)) return next();

        const route = req.url.slice(API_PREFIX.length).split("?")[0];
        res.setHeader("Content-Type", "application/json");

        try {
          switch (route) {
            case "tasks":
              res.end(JSON.stringify(await getTasks()));
              break;
            case "employees":
              res.end(JSON.stringify(await getEmployees()));
              break;
            case "config":
              res.end(JSON.stringify(await getConfig()));
              break;
            case "license":
              res.end(JSON.stringify(await getLicense()));
              break;
            case "wiki-graph":
              res.end(JSON.stringify(await getWikiGraph()));
              break;
            case "wiki-memories": {
              const url = new URL(req.url!, `http://${req.headers.host}`);
              const q = url.searchParams.get("q") || "";
              res.end(JSON.stringify(await getWikiMemories(q)));
              break;
            }
            default:
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "not_found" }));
          }
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

// ── DB helper ──────────────────────────────────────────────────────

let _dbInitialized = false;

async function getDb(): Promise<{ execute: (sql: string | { sql: string; args: unknown[] }) => Promise<{ rows: Record<string, unknown>[] }> } | null> {
  const dist = getExeOsPath();
  if (!dist) return null;

  try {
    if (!_dbInitialized) {
      const storeMod = await import(join(dist, "lib", "store.js"));
      await storeMod.initStore();
      _dbInitialized = true;
    }
    const dbMod = await import(join(dist, "lib", "database.js"));
    return dbMod.getClient();
  } catch {
    return null;
  }
}

// ── Data loaders ────────────────────────────────────────────────────

async function getTasks(): Promise<unknown[]> {
  const client = await getDb();
  if (!client) return [];

  try {
    const result = await client.execute(
      `SELECT id, title, status, priority, assigned_to, assigned_by,
              project_name, context, result, created_at, updated_at
       FROM tasks
       ORDER BY
         CASE priority WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 ELSE 2 END,
         updated_at DESC
       LIMIT 100`,
    );
    return result.rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      title: String(r.title),
      status: String(r.status),
      priority: String(r.priority),
      assignedTo: String(r.assigned_to),
      assignedBy: String(r.assigned_by ?? ""),
      project: String(r.project_name ?? ""),
      context: String(r.context ?? ""),
      result: String(r.result ?? ""),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
  } catch {
    return [];
  }
}

async function getEmployees(): Promise<unknown[]> {
  try {
    const rosterPath = join(EXE_OS_CONFIG_DIR, "exe-employees.json");
    if (!existsSync(rosterPath)) return [];
    const roster = JSON.parse(readFileSync(rosterPath, "utf8")) as Array<{
      name: string;
      role: string;
    }>;

    // Get memory counts and current tasks from DB
    const memoryCounts = new Map<string, number>();
    const currentTasks = new Map<string, string>();
    const recentTasksByEmployee = new Map<string, string[]>();

    const client = await getDb();
    if (client) {
      try {
        const memResult = await client.execute(
          "SELECT agent_id, COUNT(*) as cnt FROM memories GROUP BY agent_id",
        );
        for (const row of memResult.rows) {
          memoryCounts.set(String(row.agent_id), Number(row.cnt));
        }

        for (const emp of roster) {
          const taskResult = await client.execute({
            sql: `SELECT title FROM tasks
                  WHERE assigned_to = ? AND status = 'in_progress'
                  ORDER BY updated_at DESC LIMIT 1`,
            args: [emp.name],
          });
          if (taskResult.rows.length > 0) {
            currentTasks.set(emp.name, String(taskResult.rows[0]!.title));
          }

          const recentResult = await client.execute({
            sql: `SELECT title FROM tasks
                  WHERE assigned_to = ? AND status IN ('done', 'in_progress')
                  ORDER BY updated_at DESC LIMIT 5`,
            args: [emp.name],
          });
          recentTasksByEmployee.set(
            emp.name,
            recentResult.rows.map((r: Record<string, unknown>) => String(r.title)),
          );
        }
      } catch { /* DB queries failed */ }
    }

    // Get tmux session status
    const sessionStatus = new Map<string, string>();
    try {
      const sessions = execSync("tmux list-sessions -F '#{session_name}' 2>/dev/null", {
        encoding: "utf8",
        timeout: 2000,
      }).trim().split("\n").filter(Boolean);

      for (const emp of roster) {
        const match = sessions.find((s) =>
          s === emp.name || s.startsWith(`${emp.name}-`) || new RegExp(`^${emp.name}\\d+-`).test(s),
        );
        if (match) sessionStatus.set(emp.name, match);
      }
    } catch { /* not in tmux */ }

    return roster.map((emp) => ({
      name: emp.name,
      role: emp.role,
      status: sessionStatus.has(emp.name) ? "active" : "offline",
      memoryCount: memoryCounts.get(emp.name) ?? 0,
      currentTask: currentTasks.get(emp.name) ?? null,
      recentTasks: recentTasksByEmployee.get(emp.name) ?? [],
      sessionName: sessionStatus.get(emp.name) ?? null,
    }));
  } catch {
    return [];
  }
}

async function getLicense(): Promise<Record<string, unknown>> {
  const dist = getExeOsPath();
  if (!dist) {
    return { valid: true, plan: "free", email: "", expiresAt: null };
  }

  try {
    const licenseMod = await import(join(dist, "lib", "license.js"));
    const result = await licenseMod.checkLicense();
    return {
      valid: result.valid,
      plan: result.plan,
      email: result.email,
      expiresAt: result.expiresAt,
    };
  } catch {
    // Network or module error — allow through (user-first)
    return { valid: true, plan: "free", email: "", expiresAt: null };
  }
}

async function getConfig(): Promise<Record<string, unknown>> {
  try {
    const configPath = join(EXE_OS_CONFIG_DIR, "config.json");
    const config = existsSync(configPath)
      ? JSON.parse(readFileSync(configPath, "utf8"))
      : {};

    const licensePath = join(EXE_OS_CONFIG_DIR, "license.json");
    const license = existsSync(licensePath)
      ? JSON.parse(readFileSync(licensePath, "utf8"))
      : null;

    const cloudPath = join(EXE_OS_CONFIG_DIR, "cloud.json");
    const cloud = existsSync(cloudPath)
      ? JSON.parse(readFileSync(cloudPath, "utf8"))
      : null;

    return { ...config, license, cloud };
  } catch {
    return {};
  }
}

async function getWikiGraph(): Promise<{ entities: unknown[]; relationships: unknown[] }> {
  const client = await getDb();
  if (!client) return { entities: [], relationships: [] };

  try {
    const entResult = await client.execute(
      "SELECT id, name, type, first_seen, last_seen FROM entities ORDER BY last_seen DESC LIMIT 200",
    );
    const relResult = await client.execute(
      `SELECT r.source_entity_id, r.target_entity_id, r.type, r.weight,
              COALESCE(r.confidence, 1.0) as confidence,
              s.name as source_name, t.name as target_name
       FROM relationships r
       JOIN entities s ON r.source_entity_id = s.id
       JOIN entities t ON r.target_entity_id = t.id
       ORDER BY r.weight DESC LIMIT 500`,
    );
    return {
      entities: entResult.rows.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        name: String(r.name),
        type: String(r.type),
        first_seen: String(r.first_seen),
        last_seen: String(r.last_seen),
      })),
      relationships: relResult.rows.map((r: Record<string, unknown>) => ({
        source_entity_id: String(r.source_entity_id),
        target_entity_id: String(r.target_entity_id),
        source_name: String(r.source_name),
        target_name: String(r.target_name),
        type: String(r.type),
        weight: Number(r.weight),
        confidence: Number(r.confidence),
      })),
    };
  } catch {
    return { entities: [], relationships: [] };
  }
}

async function getWikiMemories(query: string): Promise<unknown[]> {
  if (!query) return [];
  const client = await getDb();
  if (!client) return [];

  try {
    const result = await client.execute({
      sql: `SELECT m.content, m.agent_id, m.project_name, m.created_at,
                   COALESCE(m.confidence, 1.0) as confidence
            FROM memories m
            WHERE LOWER(m.content) LIKE ?
            ORDER BY m.created_at DESC LIMIT 20`,
      args: [`%${query.toLowerCase()}%`],
    });
    return result.rows.map((r: Record<string, unknown>) => ({
      text: String(r.content),
      agent: String(r.agent_id ?? ""),
      project: String(r.project_name ?? ""),
      timestamp: String(r.created_at),
      confidence: Number(r.confidence),
    }));
  } catch {
    return [];
  }
}
