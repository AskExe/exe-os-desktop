mod daemon;

use std::process::{Command, Stdio};

use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_updater::UpdaterExt;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Build a [`Command`] that runs `program` — on Windows, the command is
/// forwarded into WSL2 (`wsl <program> <args…>`). On macOS / Linux the
/// program is invoked directly.
pub(crate) fn wsl_command(program: &str) -> Command {
    if cfg!(target_os = "windows") {
        let mut cmd = Command::new("wsl");
        cmd.arg(program);
        cmd
    } else {
        Command::new(program)
    }
}

/// Resolve the exe-os dist directory from the global npm install.
pub(crate) fn resolve_exe_os_dist() -> Result<String, String> {
    let output = wsl_command("npm")
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
    let mut cmd = wsl_command("node");
    cmd.arg("--input-type=module");

    for (key, value) in env {
        cmd.env(key, value);
    }

    // On Windows, pipe the script via stdin to avoid argument-escaping
    // issues across the WSL2 boundary. On Unix, pass it via -e directly.
    let output = if cfg!(target_os = "windows") {
        use std::io::Write;
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn node: {}", e))?;
        if let Some(ref mut stdin) = child.stdin {
            let _ = stdin.write_all(script.as_bytes());
        }
        drop(child.stdin.take());
        child
            .wait_with_output()
            .map_err(|e| format!("Failed to wait for node: {}", e))?
    } else {
        cmd.args(["-e", script]);
        cmd.output()
            .map_err(|e| format!("Failed to spawn node: {}", e))?
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Node script failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
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

const SAVE_CONFIG_SCRIPT: &str = r#"
const dist = process.env.EXE_OS_DIST;
const updates = JSON.parse(process.env.CONFIG_UPDATES);
import(dist + "/lib/config.js").then(async m => {
    const current = await m.loadConfig();
    const merged = { ...current, ...updates };
    await m.saveConfig(merged);
    console.log(JSON.stringify({ ok: true }));
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
async fn save_config(updates: String) -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;
    run_node_script(
        SAVE_CONFIG_SCRIPT,
        &[("EXE_OS_DIST", &dist), ("CONFIG_UPDATES", &updates)],
    )
}

/// Open the exe-wiki web app in a native OS webview window.
///
/// Same isolation pattern as CRM — loaded by URL only, no bundling.
/// URL from `EXE_WIKI_URL` env var; returns an error if not set.
#[tauri::command]
async fn open_wiki_window(app: tauri::AppHandle) -> Result<(), String> {
    const WIKI_WINDOW_LABEL: &str = "wiki";
    const WIKI_WINDOW_TITLE: &str = "Exe Wiki";

    let url_str = std::env::var("EXE_WIKI_URL")
        .map_err(|_| "EXE_WIKI_URL not set — configure it to connect to exe-wiki".to_string())?;
    let url = url_str
        .parse::<tauri::Url>()
        .map_err(|e| format!("Invalid EXE_WIKI_URL '{}': {}", url_str, e))?;

    if let Some(existing) = app.get_webview_window(WIKI_WINDOW_LABEL) {
        return existing.set_focus().map_err(|e| e.to_string());
    }

    const WIKI_WINDOW_WIDTH: f64 = 1280.0;
    const WIKI_WINDOW_HEIGHT: f64 = 800.0;
    const WIKI_WINDOW_MIN_WIDTH: f64 = 900.0;
    const WIKI_WINDOW_MIN_HEIGHT: f64 = 600.0;

    tauri::WebviewWindowBuilder::new(
        &app,
        WIKI_WINDOW_LABEL,
        tauri::WebviewUrl::External(url),
    )
        .title(WIKI_WINDOW_TITLE)
        .inner_size(WIKI_WINDOW_WIDTH, WIKI_WINDOW_HEIGHT)
        .min_inner_size(WIKI_WINDOW_MIN_WIDTH, WIKI_WINDOW_MIN_HEIGHT)
        .decorations(true)
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

/// Check whether WSL2 is available (Windows only; always succeeds on Unix).
/// Called by the frontend on startup to show a friendly setup guide.
#[tauri::command]
async fn check_wsl2() -> Result<String, String> {
    if !cfg!(target_os = "windows") {
        return Ok(r#"{"available":true,"platform":"unix"}"#.to_string());
    }

    Command::new("wsl")
        .arg("--status")
        .output()
        .map_err(|_| {
            "WSL2 is not installed. Run 'wsl --install' in PowerShell as \
             Administrator, then restart your computer."
                .to_string()
        })
        .and_then(|o| {
            if o.status.success() {
                Ok(())
            } else {
                Err("WSL2 is installed but not running properly. Run \
                     'wsl --install' in PowerShell as Administrator."
                    .to_string())
            }
        })?;

    // Verify Node.js is reachable inside WSL2
    let node_check = Command::new("wsl")
        .args(["node", "--version"])
        .output()
        .map_err(|_| "Cannot reach Node.js inside WSL2.".to_string())?;

    if !node_check.status.success() {
        return Err(
            "Node.js is not installed inside WSL2. \
             See https://askexe.com/docs/install for setup instructions."
                .to_string(),
        );
    }

    Ok(r#"{"available":true,"platform":"windows-wsl2"}"#.to_string())
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
            save_config,
            check_license,
            open_crm_window,
            open_wiki_window,
            spawn_session,
            daemon::start_daemon,
            daemon::stop_daemon,
            daemon::daemon_status,
            check_wsl2,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // --- System tray ---
            let show_hide = MenuItemBuilder::with_id("show_hide", "Show/Hide")
                .build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit")
                .build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .items(&[&show_hide, &quit])
                .build()?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().expect("no app icon"))
                .menu(&tray_menu)
                .tooltip("Exe OS")
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show_hide" => {
                            if let Some(win) = app.get_webview_window("main") {
                                if win.is_visible().unwrap_or(false) {
                                    let _ = win.hide();
                                } else {
                                    let _ = win.show();
                                    let _ = win.set_focus();
                                }
                            }
                        }
                        "quit" => {
                            daemon::graceful_shutdown();
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // --- Close-to-tray: hide window instead of quitting ---
            if let Some(win) = app.get_webview_window("main") {
                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });
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
