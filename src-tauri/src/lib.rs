mod daemon;

use std::process::Command;

use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Resolve the exe-os dist directory from the global npm install.
pub(crate) fn resolve_exe_os_dist() -> Result<String, String> {
    let output = Command::new("npm")
        .args(["root", "-g"])
        .output()
        .map_err(|e| format!("Failed to run npm: {}", e))?;

    if !output.status.success() {
        return Err("npm root -g failed".into());
    }

    let global_root = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(format!("{}/exe-os/dist", global_root))
}

/// Run a Node.js one-liner that imports an exe-os module and prints JSON to stdout.
///
/// The `script` MUST be a compile-time string with no interpolated user input.
/// Dynamic values flow to the Node process via `env` (keyed environment
/// variables) and are read inside the script with `process.env.FOO`. This
/// guarantees nothing user-controlled is ever parsed as JavaScript source.
fn run_node_script(script: &'static str, env: &[(&str, &str)]) -> Result<String, String> {
    let mut cmd = Command::new("node");
    cmd.args(["--input-type=module", "-e", script]);
    for (key, value) in env {
        cmd.env(key, value);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to spawn node: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Node script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(stdout)
}

// ---------------------------------------------------------------------------
// Static Node scripts — no interpolation, read all dynamic values from env.
// ---------------------------------------------------------------------------

const LIST_TASKS_SCRIPT: &str = r#"
const dist = process.env.EXE_OS_DIST;
const filter = process.env.FILTER_JSON ? JSON.parse(process.env.FILTER_JSON) : {};
import(dist + "/lib/store.js").then(s => s.initStore()).then(async () => {
    const m = await import(dist + "/lib/tasks.js");
    const tasks = await m.listTasks(filter);
    console.log(JSON.stringify(tasks));
}).catch(e => { console.error(e); process.exit(1); });
"#;

const LIST_EMPLOYEES_SCRIPT: &str = r#"
const dist = process.env.EXE_OS_DIST;
import(dist + "/lib/employees.js").then(m => {
    const employees = m.loadEmployees();
    console.log(JSON.stringify(employees));
}).catch(e => { console.error(e); process.exit(1); });
"#;

const RECALL_MEMORY_SCRIPT: &str = r#"
const dist = process.env.EXE_OS_DIST;
const query = process.env.QUERY;
const limit = Number.parseInt(process.env.LIMIT, 10);
import(dist + "/lib/store.js").then(s => s.initStore()).then(async () => {
    const m = await import(dist + "/lib/hybrid-search.js");
    const results = await m.lightweightSearch(query, { limit });
    console.log(JSON.stringify(results));
}).catch(e => { console.error(e); process.exit(1); });
"#;

const GET_CONFIG_SCRIPT: &str = r#"
const dist = process.env.EXE_OS_DIST;
import(dist + "/lib/config.js").then(m => {
    const config = m.loadConfigSync();
    console.log(JSON.stringify(config));
}).catch(e => { console.error(e); process.exit(1); });
"#;

const CHECK_LICENSE_SCRIPT: &str = r#"
const dist = process.env.EXE_OS_DIST;
import(dist + "/lib/license.js").then(async m => {
    const license = await m.checkLicense();
    console.log(JSON.stringify({
        valid: license.valid,
        plan: license.plan,
        email: license.email,
        expiresAt: license.expiresAt,
    }));
}).catch(e => { console.error(e); process.exit(1); });
"#;

const QUERY_GRAPH_SCRIPT: &str = r#"
const dist = process.env.EXE_OS_DIST;
import(dist + "/lib/store.js").then(s => s.initStore()).then(async () => {
    const db = await import(dist + "/lib/database.js");
    const client = db.getClient();
    const entResult = await client.execute(
        "SELECT id, name, type, first_seen, last_seen FROM entities ORDER BY last_seen DESC LIMIT 200"
    );
    const relResult = await client.execute(
        `SELECT r.source_entity_id, r.target_entity_id, r.type, r.weight,
                COALESCE(r.confidence, 1.0) as confidence,
                s.name as source_name, t.name as target_name
         FROM relationships r
         JOIN entities s ON r.source_entity_id = s.id
         JOIN entities t ON r.target_entity_id = t.id
         ORDER BY r.weight DESC LIMIT 500`
    );
    console.log(JSON.stringify({
        entities: entResult.rows,
        relationships: relResult.rows,
    }));
}).catch(e => { console.error(e); process.exit(1); });
"#;

const LIST_PROVIDERS_SCRIPT: &str = r#"
const dist = process.env.EXE_OS_DIST;
import(dist + "/bin/list-providers.js").then(m => {
    const providers = m.buildProviderList(process.env, m.readConfigProviders());
    console.log(JSON.stringify(providers));
}).catch(e => { console.error(e); process.exit(1); });
"#;

const SPAWN_SESSION_SCRIPT: &str = r#"
const dist = process.env.EXE_OS_DIST;
const name = process.env.EMPLOYEE_NAME;
const exe = process.env.EXE_SESSION;
const cwd = process.env.WORKING_DIR;
import(dist + "/lib/tmux-routing.js").then(m => {
    const result = m.ensureEmployee(name, exe, cwd);
    console.log(JSON.stringify(result));
}).catch(e => { console.error(e); process.exit(1); });
"#;

// ---------------------------------------------------------------------------
// Tauri IPC commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn list_tasks(filter: Option<String>) -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;
    let filter_json = filter.unwrap_or_else(|| "{}".to_string());

    run_node_script(
        LIST_TASKS_SCRIPT,
        &[("EXE_OS_DIST", &dist), ("FILTER_JSON", &filter_json)],
    )
}

#[tauri::command]
async fn list_employees() -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;
    run_node_script(LIST_EMPLOYEES_SCRIPT, &[("EXE_OS_DIST", &dist)])
}

#[tauri::command]
async fn recall_memory(query: String, limit: Option<u32>) -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;
    let max = limit.unwrap_or(10).to_string();

    run_node_script(
        RECALL_MEMORY_SCRIPT,
        &[
            ("EXE_OS_DIST", &dist),
            ("QUERY", &query),
            ("LIMIT", &max),
        ],
    )
}

#[tauri::command]
async fn get_config() -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;
    run_node_script(GET_CONFIG_SCRIPT, &[("EXE_OS_DIST", &dist)])
}

#[tauri::command]
async fn check_license() -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;
    run_node_script(CHECK_LICENSE_SCRIPT, &[("EXE_OS_DIST", &dist)])
}

#[tauri::command]
async fn query_graph() -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;
    run_node_script(QUERY_GRAPH_SCRIPT, &[("EXE_OS_DIST", &dist)])
}

#[tauri::command]
async fn list_providers() -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;
    run_node_script(LIST_PROVIDERS_SCRIPT, &[("EXE_OS_DIST", &dist)])
}

/// Open the exe-crm web app in a native OS webview window.
///
/// AGPL boundary: exe-crm is a separate AGPL codebase loaded by URL only.
/// Do NOT replace WebviewUrl::External with an iframe, Vite dev proxy, or
/// in-bundle import — each of those would pull third-party origin code
/// into the Tauri process and break the white-label distribution story.
/// The URL is env-overridable (`EXE_CRM_URL`) so distributors can point
/// at their own white-labeled instance without rebuilding.
#[tauri::command]
async fn open_crm_window(app: tauri::AppHandle) -> Result<(), String> {
    const DEFAULT_CRM_URL: &str = "https://crm.askexe.com";
    const CRM_WINDOW_LABEL: &str = "crm";
    const CRM_WINDOW_TITLE: &str = "Exe CRM";

    let url_str = std::env::var("EXE_CRM_URL").unwrap_or_else(|_| DEFAULT_CRM_URL.to_string());
    let url = url_str
        .parse::<tauri::Url>()
        .map_err(|e| format!("Invalid EXE_CRM_URL '{}': {}", url_str, e))?;

    // Focus the existing window if the user already opened the CRM; this
    // keeps the session + cookie jar stable across repeated clicks.
    if let Some(existing) = app.get_webview_window(CRM_WINDOW_LABEL) {
        return existing.set_focus().map_err(|e| e.to_string());
    }

    const CRM_WINDOW_WIDTH: f64 = 1280.0;
    const CRM_WINDOW_HEIGHT: f64 = 800.0;
    const CRM_WINDOW_MIN_WIDTH: f64 = 900.0;
    const CRM_WINDOW_MIN_HEIGHT: f64 = 600.0;

    tauri::WebviewWindowBuilder::new(
        &app,
        CRM_WINDOW_LABEL,
        tauri::WebviewUrl::External(url),
    )
        .title(CRM_WINDOW_TITLE)
        .inner_size(CRM_WINDOW_WIDTH, CRM_WINDOW_HEIGHT)
        .min_inner_size(CRM_WINDOW_MIN_WIDTH, CRM_WINDOW_MIN_HEIGHT)
        .decorations(true)
        // devtools() gated to debug builds only — prod never exposes the
        // CRM webview's DevTools surface (AGPL hardening + privacy hygiene).
        .devtools(cfg!(debug_assertions))
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn spawn_session(
    employee_name: String,
    exe_session: String,
    working_dir: String,
) -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;

    run_node_script(
        SPAWN_SESSION_SCRIPT,
        &[
            ("EXE_OS_DIST", &dist),
            ("EMPLOYEE_NAME", &employee_name),
            ("EXE_SESSION", &exe_session),
            ("WORKING_DIR", &working_dir),
        ],
    )
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            list_tasks,
            list_employees,
            list_providers,
            recall_memory,
            query_graph,
            get_config,
            check_license,
            open_crm_window,
            spawn_session,
            daemon::start_daemon,
            daemon::stop_daemon,
            daemon::daemon_status,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_for_updates(handle).await;
            });

            // Auto-start the exe-os daemon after updater check
            daemon::auto_start();

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_handle, event| {
            if let tauri::RunEvent::Exit = event {
                daemon::graceful_shutdown();
            }
        });
}

async fn check_for_updates(app: tauri::AppHandle) {
    let updater = match app.updater() {
        Ok(updater) => updater,
        Err(e) => {
            log::warn!("Failed to initialize updater: {}", e);
            return;
        }
    };

    let update = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => {
            log::info!("No update available");
            return;
        }
        Err(e) => {
            log::warn!("Update check failed (endpoint may not be configured yet): {}", e);
            return;
        }
    };

    log::info!(
        "Update available: {} -> {}",
        update.current_version,
        update.version
    );

    if let Err(e) = update.download_and_install(|_chunk, _total| {}, || {}).await {
        log::error!("Failed to download and install update: {}", e);
    }
}
