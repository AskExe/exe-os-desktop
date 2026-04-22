//! Daemon lifecycle manager — spawns / stops the exe-os daemon (Node.js child process).
//!
//! The daemon provides embedding services (via Unix socket) and orchestration
//! (review polling, idle nudge, session TTL, capacity monitoring, etc).
//! The Tauri app manages its lifecycle: auto-start on launch, graceful shutdown on exit.

use std::io::BufRead;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;

/// Default IPC WebSocket port for desktop mode.
const DEFAULT_PORT: u16 = 9221;

/// Seconds to wait after SIGTERM before escalating to SIGKILL.
const SHUTDOWN_TIMEOUT_SECS: u64 = 5;

/// Daemon status returned to the frontend.
#[derive(Serialize, Clone)]
pub struct DaemonStatus {
    pub running: bool,
    pub port: u16,
    pub pid: u32,
}

struct DaemonProcess {
    child: Child,
    port: u16,
    pid: u32,
}

static DAEMON: Mutex<Option<DaemonProcess>> = Mutex::new(None);

// ---------------------------------------------------------------------------
// PID file
// ---------------------------------------------------------------------------

fn pid_file_path() -> Result<std::path::PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "HOME/USERPROFILE not set".to_string())?;
    Ok(std::path::PathBuf::from(home)
        .join(".exe-os")
        .join("session-cache")
        .join("daemon-desktop.json"))
}

fn write_pid_file(pid: u32, port: u16) -> Result<(), String> {
    let path = pid_file_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir: {e}"))?;
    }
    let json = serde_json::json!({ "pid": pid, "port": port });
    std::fs::write(&path, json.to_string()).map_err(|e| format!("write pid file: {e}"))
}

fn remove_pid_file() {
    if let Ok(p) = pid_file_path() {
        let _ = std::fs::remove_file(p);
    }
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------

fn is_process_alive(pid: u32) -> bool {
    if cfg!(target_os = "windows") {
        // PID is a Windows process (wsl.exe); check via tasklist
        Command::new("tasklist")
            .args(["/fi", &format!("PID eq {pid}"), "/nh"])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string()))
            .unwrap_or(false)
    } else {
        Command::new("kill")
            .args(["-0", &pid.to_string()])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }
}

fn send_signal(pid: u32, signal: &str) {
    if cfg!(target_os = "windows") {
        // Map Unix signals to taskkill flags (/f = forceful for SIGKILL)
        let pid_str = pid.to_string();
        let mut args = vec!["/pid", &pid_str, "/t"];
        if signal == "-9" || signal == "-KILL" {
            args.push("/f");
        }
        let _ = Command::new("taskkill")
            .args(&args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    } else {
        let _ = Command::new("kill")
            .args([signal, &pid.to_string()])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

/// Wait for a child to exit, escalating from SIGTERM to SIGKILL after timeout.
fn wait_or_kill(child: &mut Child, pid: u32) {
    let deadline = std::time::Instant::now() + Duration::from_secs(SHUTDOWN_TIMEOUT_SECS);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) if std::time::Instant::now() >= deadline => {
                send_signal(pid, "-9");
                let _ = child.wait();
                return;
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(100)),
            Err(_) => return,
        }
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn start_daemon() -> Result<DaemonStatus, String> {
    let mut guard = DAEMON.lock().map_err(|e| format!("lock poisoned: {e}"))?;

    // Already running — return current status
    if let Some(ref daemon) = *guard {
        if is_process_alive(daemon.pid) {
            return Ok(DaemonStatus {
                running: true,
                port: daemon.port,
                pid: daemon.pid,
            });
        }
        // Stale entry
        remove_pid_file();
    }

    let dist = crate::resolve_exe_os_dist()?;
    let script = format!("{dist}/lib/exe-daemon.js");

    // Prepend common Node install paths — Finder/Explorer-launched apps get a minimal PATH
    let path = std::env::var("PATH").unwrap_or_default();
    let enhanced_path = if cfg!(target_os = "windows") {
        // WSL2 paths for Node.js
        format!("/usr/local/bin:/usr/bin:{path}")
    } else {
        // macOS Homebrew paths
        format!("/opt/homebrew/bin:/usr/local/bin:{path}")
    };

    let mut child = crate::wsl_command("node")
        .arg(&script)
        .env("PATH", &enhanced_path)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn daemon: {e}"))?;

    let pid = child.id();
    let port = DEFAULT_PORT;

    // Forward daemon stderr to Tauri log in a background thread
    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let reader = std::io::BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                log::info!("{}", line);
            }
        });
    }

    write_pid_file(pid, port)?;
    *guard = Some(DaemonProcess { child, port, pid });

    Ok(DaemonStatus { running: true, port, pid })
}

#[tauri::command]
pub async fn stop_daemon() -> Result<(), String> {
    // Take the daemon out of the mutex, then release the lock before waiting
    let taken = {
        let mut guard = DAEMON.lock().map_err(|e| format!("lock poisoned: {e}"))?;
        guard.take()
    };

    if let Some(mut daemon) = taken {
        send_signal(daemon.pid, "-TERM");
        wait_or_kill(&mut daemon.child, daemon.pid);
        remove_pid_file();
    }

    Ok(())
}

#[tauri::command]
pub async fn daemon_status() -> Result<DaemonStatus, String> {
    let guard = DAEMON.lock().map_err(|e| format!("lock poisoned: {e}"))?;

    match &*guard {
        Some(d) if is_process_alive(d.pid) => Ok(DaemonStatus {
            running: true,
            port: d.port,
            pid: d.pid,
        }),
        _ => Ok(DaemonStatus {
            running: false,
            port: DEFAULT_PORT,
            pid: 0,
        }),
    }
}

// ---------------------------------------------------------------------------
// Lifecycle hooks (called from lib.rs)
// ---------------------------------------------------------------------------

/// Auto-start the daemon. Called from Tauri setup callback.
pub fn auto_start() {
    tauri::async_runtime::spawn(async {
        match start_daemon().await {
            Ok(s) => log::info!("Daemon auto-started: pid={} port={}", s.pid, s.port),
            Err(e) => log::error!("Daemon auto-start failed: {e}"),
        }
    });
}

/// Graceful shutdown. Called synchronously on app exit.
pub fn graceful_shutdown() {
    let taken = match DAEMON.lock() {
        Ok(mut g) => g.take(),
        Err(_) => return,
    };

    if let Some(mut daemon) = taken {
        send_signal(daemon.pid, "-TERM");
        wait_or_kill(&mut daemon.child, daemon.pid);
        remove_pid_file();
    }
}
