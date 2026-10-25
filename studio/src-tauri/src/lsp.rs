//! The Lua language server (LuaLS) as a helper process. The studio's editor speaks the language server protocol to it through three commands:
//! `lsp_start` launches it for a game, `lsp_send` writes one JSON message, and every message it sends comes back as an `lsp-message` event
//! (the Content-Length framing stays on this side, so the front end only deals in JSON text). It is optional: `scripts/fetch-luals.sh` installs it.

use std::{
    fs,
    io::{BufRead, BufReader, Read, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::Mutex,
    thread,
};
use serde::Serialize;
use tauri::Manager;
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
pub struct LspState {
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
}

#[derive(Serialize)]
pub struct LspInfo {
    /// Absolute path of the game's folder: the language server's workspace root.
    root: String,
}

/// The server: the workspace's own copy (scripts/fetch-luals.sh) when there is one, so a developer can try another version, otherwise the
/// one bundled inside the app (tauri.conf.json bundle.resources puts third_party/luals there as `luals`).
fn luals_bin(app: &AppHandle, ws: &std::path::Path) -> Option<PathBuf> {
    let own = ws.join("third_party").join("luals").join("bin").join("lua-language-server");
    if own.is_file() {
        return Some(own);
    }
    let bundled = app.path().resource_dir().ok()?.join("luals").join("bin").join("lua-language-server");
    bundled.is_file().then_some(bundled)
}

pub fn stop(state: &LspState) {
    *state.stdin.lock().unwrap() = None; // closing its input makes the server exit
    if let Some(mut c) = state.child.lock().unwrap().take() {
        let _ = c.kill();
        let _ = c.wait();
    }
}

/// What the server is told about the project: Lua 5.4, our API annotations as a library, and quiet defaults for beginners.
fn write_config(ws: &std::path::Path, scratch: &std::path::Path) -> Result<PathBuf, String> {
    let dir = scratch.join("luals");
    fs::create_dir_all(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    let api = ws.join("engine").join("api");
    let config = serde_json::json!({
        "runtime": { "version": "Lua 5.4", "path": ["?.lua", "?/init.lua"] },
        "workspace": { "library": [api.to_string_lossy()], "checkThirdParty": false },
        "diagnostics": {
            // classes are open: a game adds its own fields to self, and hooks often leave arguments unused
            "disable": ["undefined-field", "inject-field", "duplicate-set-field", "lowercase-global", "need-check-nil"],
            "severity": { "unused-local": "Hint", "unused-function": "Hint" },
        },
        "completion": { "callSnippet": "Disable", "keywordSnippet": "Disable", "displayContext": 0 },
        "hint": { "enable": false },
        "telemetry": { "enable": false },
    });
    let path = dir.join("luarc.json");
    fs::write(&path, serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(path)
}

#[tauri::command]
pub fn lsp_start(app: AppHandle, state: State<'_, LspState>, cart: String) -> Result<LspInfo, String> {
    let ws = super::workspace(&app);
    let Some(bin) = luals_bin(&app, &ws) else {
        return Err("the Lua language server is not installed (run scripts/fetch-luals.sh)".into());
    };
    let root = super::cart_dir(&app, &cart)?;
    let config = write_config(&ws, &super::scratch_dir(&app))?;
    stop(&state);
    let work = ws.join("build").join("luals");
    let mut child = Command::new(&bin)
        .arg(format!("--configpath={}", config.display()))
        .arg(format!("--logpath={}", work.join("log").display()))
        .arg(format!("--metapath={}", work.join("meta").display()))
        .current_dir(&ws)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("could not start the Lua language server: {e}"))?;
    let stdin = child.stdin.take().ok_or("no stdin")?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    *state.stdin.lock().unwrap() = Some(stdin);
    *state.child.lock().unwrap() = Some(child);
    let app2 = app.clone();
    thread::spawn(move || {
        let mut r = BufReader::new(stdout);
        loop {
            // headers: "Content-Length: N" then a blank line
            let mut len = 0usize;
            loop {
                let mut line = String::new();
                match r.read_line(&mut line) {
                    Ok(0) | Err(_) => return,
                    Ok(_) => {}
                }
                let line = line.trim_end();
                if line.is_empty() {
                    break;
                }
                if let Some(v) = line.strip_prefix("Content-Length:") {
                    len = v.trim().parse().unwrap_or(0);
                }
            }
            if len == 0 || len > 64 * 1024 * 1024 {
                continue;
            }
            let mut body = vec![0u8; len];
            if r.read_exact(&mut body).is_err() {
                return;
            }
            if let Ok(text) = String::from_utf8(body) {
                let _ = app2.emit("lsp-message", text);
            }
        }
    });
    Ok(LspInfo { root: root.to_string_lossy().into_owned() })
}

#[tauri::command]
pub fn lsp_send(state: State<'_, LspState>, message: String) -> Result<(), String> {
    let mut guard = state.stdin.lock().unwrap();
    let stdin = guard.as_mut().ok_or("the Lua language server is not running")?;
    let frame = format!("Content-Length: {}\r\n\r\n{}", message.len(), message);
    stdin.write_all(frame.as_bytes()).and_then(|_| stdin.flush()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn lsp_stop(state: State<'_, LspState>) {
    stop(&state);
}
