use std::process::Command;

use tauri_plugin_updater::UpdaterExt;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Resolve the exe-os dist directory from the global npm install.
fn resolve_exe_os_dist() -> Result<String, String> {
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
fn run_node_script(script: &str) -> Result<String, String> {
    let output = Command::new("node")
        .args(["--input-type=module", "-e", script])
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
// Tauri IPC commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn list_tasks(filter: Option<String>) -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;
    let filter_json = filter.unwrap_or_else(|| "{}".to_string());

    let script = format!(
        r#"
        import("{dist}/lib/store.js").then(s => s.initStore()).then(async () => {{
            const m = await import("{dist}/lib/tasks.js");
            const filter = {filter_json};
            const tasks = await m.listTasks(filter);
            console.log(JSON.stringify(tasks));
        }}).catch(e => {{ console.error(e); process.exit(1); }});
        "#,
        dist = dist,
        filter_json = filter_json,
    );

    run_node_script(&script)
}

#[tauri::command]
async fn list_employees() -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;

    let script = format!(
        r#"
        import("{dist}/lib/employees.js").then(m => {{
            const employees = m.loadEmployees();
            console.log(JSON.stringify(employees));
        }}).catch(e => {{ console.error(e); process.exit(1); }});
        "#,
        dist = dist,
    );

    run_node_script(&script)
}

#[tauri::command]
async fn recall_memory(query: String, limit: Option<u32>) -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;
    let max = limit.unwrap_or(10);

    let script = format!(
        r#"
        import("{dist}/lib/store.js").then(s => s.initStore()).then(async () => {{
            const m = await import("{dist}/lib/hybrid-search.js");
            const results = await m.lightweightSearch("{query}", {{ limit: {max} }});
            console.log(JSON.stringify(results));
        }}).catch(e => {{ console.error(e); process.exit(1); }});
        "#,
        dist = dist,
        query = query.replace('"', r#"\""#),
        max = max,
    );

    run_node_script(&script)
}

#[tauri::command]
async fn get_config() -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;

    let script = format!(
        r#"
        import("{dist}/lib/config.js").then(m => {{
            const config = m.loadConfigSync();
            console.log(JSON.stringify(config));
        }}).catch(e => {{ console.error(e); process.exit(1); }});
        "#,
        dist = dist,
    );

    run_node_script(&script)
}

#[tauri::command]
async fn check_license() -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;

    let script = format!(
        r#"
        import("{dist}/lib/license.js").then(async m => {{
            const license = await m.checkLicense();
            console.log(JSON.stringify({{
                valid: license.valid,
                plan: license.plan,
                email: license.email,
                expiresAt: license.expiresAt
            }}));
        }}).catch(e => {{ console.error(e); process.exit(1); }});
        "#,
        dist = dist,
    );

    run_node_script(&script)
}

#[tauri::command]
async fn spawn_session(employee_name: String, exe_session: String, working_dir: String) -> Result<String, String> {
    let dist = resolve_exe_os_dist()?;

    let script = format!(
        r#"
        import("{dist}/lib/tmux-routing.js").then(m => {{
            const result = m.ensureEmployee("{name}", "{exe}", "{cwd}");
            console.log(JSON.stringify(result));
        }}).catch(e => {{ console.error(e); process.exit(1); }});
        "#,
        dist = dist,
        name = employee_name.replace('"', r#"\""#),
        exe = exe_session.replace('"', r#"\""#),
        cwd = working_dir.replace('"', r#"\""#),
    );

    run_node_script(&script)
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
            recall_memory,
            get_config,
            check_license,
            spawn_session,
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

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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
