/**
 * Vite plugin that serves exe-os data as local API endpoints during dev.
 *
 * Routes:
 *   GET /api/tasks     — all tasks from exe-os DB
 *   GET /api/employees — employee roster + memory counts + current tasks
 *   GET /api/config    — exe-os config from ~/.exe-os/config.json
 *
 * When Tauri IPC is available, the frontend will use invoke() instead
 * and this plugin becomes unnecessary.
 */

import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

const API_PREFIX = "/api/";

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

// ── Data loaders ────────────────────────────────────────────────────

async function getTasks(): Promise<unknown[]> {
  try {
    const { initStore } = await import("exe-os/dist/lib/store.js");
    await initStore();
    const { getClient } = await import("exe-os/dist/lib/database.js");
    const client = getClient();
    const result = await client.execute(
      `SELECT id, title, status, priority, assigned_to, assigned_by,
              project_name, context, result, created_at, updated_at
       FROM tasks
       ORDER BY
         CASE priority WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 ELSE 2 END,
         updated_at DESC
       LIMIT 100`,
    );
    return result.rows.map((r) => ({
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
    const { readFileSync } = await import("node:fs");
    const { homedir } = await import("node:os");
    const rosterPath = `${homedir()}/.exe-os/exe-employees.json`;
    const roster = JSON.parse(readFileSync(rosterPath, "utf8")) as Array<{
      name: string;
      role: string;
    }>;

    // Get memory counts and current tasks from DB
    let memoryCounts = new Map<string, number>();
    let currentTasks = new Map<string, string>();
    let recentTasksByEmployee = new Map<string, string[]>();

    try {
      const { initStore } = await import("exe-os/dist/lib/store.js");
      await initStore();
      const { getClient } = await import("exe-os/dist/lib/database.js");
      const client = getClient();

      // Memory counts per agent
      const memResult = await client.execute(
        "SELECT agent_id, COUNT(*) as cnt FROM memories GROUP BY agent_id",
      );
      for (const row of memResult.rows) {
        memoryCounts.set(String(row.agent_id), Number(row.cnt));
      }

      // Current in_progress task per employee
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

        // Recent tasks (last 5)
        const recentResult = await client.execute({
          sql: `SELECT title FROM tasks
                WHERE assigned_to = ? AND status IN ('done', 'in_progress')
                ORDER BY updated_at DESC LIMIT 5`,
          args: [emp.name],
        });
        recentTasksByEmployee.set(
          emp.name,
          recentResult.rows.map((r) => String(r.title)),
        );
      }
    } catch { /* DB not available */ }

    // Get tmux session status
    let sessionStatus = new Map<string, string>();
    try {
      const { execSync } = await import("node:child_process");
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

async function getConfig(): Promise<Record<string, unknown>> {
  try {
    const { readFileSync, existsSync } = await import("node:fs");
    const { homedir } = await import("node:os");

    const configPath = `${homedir()}/.exe-os/config.json`;
    const config = existsSync(configPath)
      ? JSON.parse(readFileSync(configPath, "utf8"))
      : {};

    // Check for license
    const licensePath = `${homedir()}/.exe-os/license.json`;
    const license = existsSync(licensePath)
      ? JSON.parse(readFileSync(licensePath, "utf8"))
      : null;

    // Check cloud sync status
    const cloudPath = `${homedir()}/.exe-os/cloud.json`;
    const cloud = existsSync(cloudPath)
      ? JSON.parse(readFileSync(cloudPath, "utf8"))
      : null;

    return {
      ...config,
      license,
      cloud,
    };
  } catch {
    return {};
  }
}
