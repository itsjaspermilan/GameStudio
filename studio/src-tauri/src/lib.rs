//! GameStudio backend: project files, desktop preview, packing, and sending to a device.
//! The runtime itself (`gs`) is the C program built by scripts/build*.sh; this app drives it.

use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{BufRead, BufReader, Read, Write},
    net::{Shutdown, TcpListener, TcpStream},
    path::{Component, Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{atomic::{AtomicU64, Ordering}, Mutex},
    thread,
    time::Duration,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
mod lsp;
use tauri::{ipc::{Channel, InvokeResponseBody}, AppHandle, Emitter, Manager, State};

#[derive(Serialize, Deserialize, Clone, Default)]
struct Settings {
    workspace: String,
    device_host: String,
    device_user: String,
    device_dir: String,
}

#[derive(Serialize)]
struct RuntimeStatus {
    desktop: bool,
    device: bool,
}

#[derive(Serialize, Clone)]
struct LogLine {
    stream: &'static str,
    line: String,
}

#[derive(Default)]
struct AppState {
    preview: Mutex<Option<Child>>,
    /// Bumped whenever the preview is started or stopped, so stale monitor threads stay quiet.
    generation: Mutex<u64>,
    /// Process id (and group id) of a running `scripts/push.sh`, so the Stop button can cancel a send.
    push_pid: Mutex<Option<u32>>,
    /// The connection to a game running in the studio's own preview panel (GS_EMBED), for sending it the buttons held.
    embed: Mutex<Option<TcpStream>>,
}

/// The console's screen, for a game shown inside the studio.
#[derive(Deserialize)]
struct EmbedSize {
    width: u32,
    height: u32,
}

// ---------- settings ----------

fn default_workspace() -> String {
    // In development the studio lives in <workspace>/studio/src-tauri.
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

fn load_settings(app: &AppHandle) -> Settings {
    let mut s: Settings = settings_path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default();
    if s.workspace.is_empty() {
        s.workspace = default_workspace();
    }
    if s.device_user.is_empty() {
        s.device_user = "root".into();
    }
    s
}

#[tauri::command]
fn get_settings(app: AppHandle) -> Settings {
    load_settings(&app)
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let path = settings_path(&app)?;
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

fn workspace(app: &AppHandle) -> PathBuf {
    PathBuf::from(load_settings(app).workspace)
}

fn desktop_bin(ws: &Path) -> PathBuf {
    ws.join("build").join(if cfg!(windows) { "gs.exe" } else { "gs" })
}

fn device_bin(ws: &Path) -> PathBuf {
    ws.join("build-aarch64").join("gs")
}

#[tauri::command]
fn runtime_status(app: AppHandle) -> RuntimeStatus {
    let ws = workspace(&app);
    RuntimeStatus { desktop: desktop_bin(&ws).is_file(), device: device_bin(&ws).is_file() }
}

// ---------- path safety ----------

fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && !name.starts_with('.')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// A relative path inside a cart: forward slashes, each part [A-Za-z0-9_.-], no `.`/`..`, no hidden parts.
fn safe_rel(rel: &str) -> Result<PathBuf, String> {
    if rel.is_empty() || rel.len() > 200 {
        return Err("invalid file name".into());
    }
    let mut out = PathBuf::new();
    for part in rel.split('/') {
        let ok = !part.is_empty()
            && !part.starts_with('.')
            && part.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.');
        if !ok {
            return Err(format!("invalid file name: {rel}"));
        }
        out.push(part);
    }
    if out.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err("invalid file name".into());
    }
    Ok(out)
}

fn cart_dir(app: &AppHandle, cart: &str) -> Result<PathBuf, String> {
    if !valid_name(cart) {
        return Err("invalid game name (use letters, digits, - and _)".into());
    }
    Ok(workspace(app).join("carts").join(cart))
}

// ---------- custom consoles ----------
// Built-in consoles ship with the studio; custom ones are saved as <workspace>/consoles/<id>.json.

const RESERVED_CONSOLES: [&str; 7] = ["glow43", "glow169", "dot", "dash", "legacy", "pocket", "wide"];

fn valid_console_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 40 && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

/// The text of every custom console file; the studio parses and validates them.
#[tauri::command]
fn list_consoles(app: AppHandle) -> Vec<String> {
    let dir = workspace(&app).join("consoles");
    let mut files: Vec<PathBuf> = match fs::read_dir(&dir) {
        Ok(rd) => rd.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.extension().map_or(false, |x| x == "json")).collect(),
        Err(_) => Vec::new(),
    };
    files.sort();
    files.iter().filter_map(|p| fs::read_to_string(p).ok()).collect()
}

#[tauri::command]
fn save_console(app: AppHandle, id: String, content: String) -> Result<(), String> {
    if !valid_console_id(&id) {
        return Err("a console id uses 1-40 lowercase letters, digits, - and _".into());
    }
    if RESERVED_CONSOLES.contains(&id.as_str()) {
        return Err(format!("'{id}' is the name of a built-in console"));
    }
    if content.len() > 64 * 1024 {
        return Err("that console file is too large".into());
    }
    let value: serde_json::Value = serde_json::from_str(&content).map_err(|e| format!("not valid JSON: {e}"))?;
    if value["id"].as_str() != Some(id.as_str()) {
        return Err("the console's id must match its file name".into());
    }
    let dir = workspace(&app).join("consoles");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())? + "\n";
    fs::write(dir.join(format!("{id}.json")), text).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_console(app: AppHandle, id: String) -> Result<(), String> {
    if !valid_console_id(&id) || RESERVED_CONSOLES.contains(&id.as_str()) {
        return Err("that console can't be deleted".into());
    }
    let path = workspace(&app).join("consoles").join(format!("{id}.json"));
    if path.is_file() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------- project files ----------

#[tauri::command]
fn list_carts(app: AppHandle) -> Result<Vec<String>, String> {
    let dir = workspace(&app).join("carts");
    let mut names: Vec<String> = match fs::read_dir(&dir) {
        Ok(rd) => rd
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .filter_map(|e| e.file_name().into_string().ok())
            .filter(|n| valid_name(n))
            .collect(),
        Err(_) => Vec::new(),
    };
    names.sort();
    Ok(names)
}

#[derive(Serialize)]
struct GameInfo {
    name: String,
    /// "game" (has a game.lua) or "lua" (no game.lua: an old plain main.lua game, which the runtime no longer runs)
    kind: &'static str,
}

#[tauri::command]
fn list_games(app: AppHandle) -> Result<Vec<GameInfo>, String> {
    let root = workspace(&app).join("carts");
    Ok(list_carts(app)?
        .into_iter()
        .map(|name| {
            let kind = if root.join(&name).join("game.lua").is_file() { "game" } else { "lua" };
            GameInfo { name, kind }
        })
        .collect())
}

fn walk(base: &Path, dir: &Path, out: &mut Vec<String>) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    for e in rd.filter_map(|e| e.ok()) {
        let name = e.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let path = e.path();
        if path.is_dir() {
            walk(base, &path, out);
        } else if let Ok(rel) = path.strip_prefix(base) {
            out.push(rel.to_string_lossy().replace('\\', "/"));
        }
    }
}

#[tauri::command]
fn list_files(app: AppHandle, cart: String) -> Result<Vec<String>, String> {
    let dir = cart_dir(&app, &cart)?;
    let mut out = Vec::new();
    walk(&dir, &dir, &mut out);
    out.sort();
    Ok(out)
}

#[tauri::command]
fn read_file(app: AppHandle, cart: String, rel: String) -> Result<String, String> {
    let path = cart_dir(&app, &cart)?.join(safe_rel(&rel)?);
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 2 * 1024 * 1024 {
        return Err("file too large to edit".into());
    }
    fs::read_to_string(&path).map_err(|e| format!("{rel}: {e}"))
}

fn write_bytes(path: &Path, bytes: &[u8], rel: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("{rel}: {e}"))?;
    }
    fs::write(path, bytes).map_err(|e| format!("{rel}: {e}"))
}

/// Total size in bytes of a game's files (what a packed cartridge will hold, plus a little).
#[tauri::command]
fn cart_size(app: AppHandle, cart: String) -> Result<u64, String> {
    // meta/ (box art for game lists) is not packed into the cartridge, so it does not count toward its size
    fn total(dir: &Path, top: bool) -> u64 {
        let Ok(rd) = fs::read_dir(dir) else { return 0 };
        rd.filter_map(|e| e.ok())
            .filter(|e| !e.file_name().to_string_lossy().starts_with('.'))
            .filter(|e| !(top && e.file_name() == "meta"))
            .map(|e| {
                let p = e.path();
                if p.is_dir() { total(&p, false) } else { e.metadata().map(|m| m.len()).unwrap_or(0) }
            })
            .sum()
    }
    Ok(total(&cart_dir(&app, &cart)?, true))
}

#[tauri::command]
fn write_file(app: AppHandle, cart: String, rel: String, content: String) -> Result<(), String> {
    let path = cart_dir(&app, &cart)?.join(safe_rel(&rel)?);
    write_bytes(&path, content.as_bytes(), &rel)
}

/// Binary files (images, sounds) cross the IPC boundary as base64 text.
#[tauri::command]
fn read_binary(app: AppHandle, cart: String, rel: String) -> Result<String, String> {
    let path = cart_dir(&app, &cart)?.join(safe_rel(&rel)?);
    let meta = fs::metadata(&path).map_err(|e| format!("{rel}: {e}"))?;
    if meta.len() > 16 * 1024 * 1024 {
        return Err("file too large".into());
    }
    let bytes = fs::read(&path).map_err(|e| format!("{rel}: {e}"))?;
    Ok(B64.encode(bytes))
}

#[tauri::command]
fn write_binary(app: AppHandle, cart: String, rel: String, data: String) -> Result<(), String> {
    let path = cart_dir(&app, &cart)?.join(safe_rel(&rel)?);
    let bytes = B64.decode(data.as_bytes()).map_err(|e| format!("bad data: {e}"))?;
    write_bytes(&path, &bytes, &rel)
}

/// Moves one file inside a game (used to rename a resource's files).
#[tauri::command]
fn rename_file(app: AppHandle, cart: String, from: String, to: String) -> Result<(), String> {
    let base = cart_dir(&app, &cart)?;
    let (a, b) = (base.join(safe_rel(&from)?), base.join(safe_rel(&to)?));
    if !a.is_file() {
        return Err(format!("{from} doesn't exist"));
    }
    if b.exists() {
        return Err(format!("{to} already exists"));
    }
    if let Some(parent) = b.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(&a, &b).map_err(|e| format!("{from}: {e}"))
}

/// Deletes one file inside a game (used when removing a resource and its assets).
#[tauri::command]
fn delete_file(app: AppHandle, cart: String, rel: String) -> Result<(), String> {
    let path = cart_dir(&app, &cart)?.join(safe_rel(&rel)?);
    if path.is_file() {
        fs::remove_file(&path).map_err(|e| format!("{rel}: {e}"))?;
    }
    Ok(())
}

/// Makes the game's folder; the studio writes the starter files (project-core.js `newGameFiles`) into it.
#[tauri::command]
fn new_cart(app: AppHandle, name: String) -> Result<(), String> {
    let dir = cart_dir(&app, &name)?;
    if dir.exists() {
        return Err(format!("'{name}' already exists"));
    }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())
}

#[tauri::command]
fn new_file(app: AppHandle, cart: String, rel: String) -> Result<(), String> {
    let path = cart_dir(&app, &cart)?.join(safe_rel(&rel)?);
    if path.exists() {
        return Err(format!("{rel} already exists"));
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, "").map_err(|e| e.to_string())
}

// ---------- processes ----------

fn emit_log(app: &AppHandle, stream: &'static str, line: String) {
    let _ = app.emit("log", LogLine { stream, line });
}

fn pipe_lines<R: Read + Send + 'static>(app: AppHandle, r: R, stream: &'static str) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        for line in BufReader::new(r).lines().map_while(Result::ok) {
            emit_log(&app, stream, line);
        }
    })
}

/// Run a command to completion, streaming its output to the log. Returns whether it succeeded.
fn run_logged(app: &AppHandle, cmd: &mut Command) -> Result<bool, String> {
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| format!("could not start {:?}: {e}", cmd.get_program()))?;
    let out = pipe_lines(app.clone(), child.stdout.take().unwrap(), "stdout");
    let err = pipe_lines(app.clone(), child.stderr.take().unwrap(), "stderr");
    let status = child.wait().map_err(|e| e.to_string())?;
    let _ = out.join();
    let _ = err.join();
    Ok(status.success())
}

/// Runs the game with live reload (GS_DEV): saving a Lua file or an asset changes the running game. With `embed` it has no window: it draws
/// at the console's size and sends its frames to `on_frame` (runtime/main.c, "embedded preview"), and `preview_buttons` passes it the
/// buttons held. Without, it opens a window of its own (and `on_frame` stays unused).
#[tauri::command]
fn run_preview(app: AppHandle, state: State<'_, AppState>, cart: String, embed: Option<EmbedSize>, on_frame: Channel) -> Result<(), String> {
    let ws = workspace(&app);
    let bin = desktop_bin(&ws);
    if !bin.is_file() {
        return Err(format!("runtime not found at {}. Run scripts/build.sh in the workspace.", bin.display()));
    }
    let dir = cart_dir(&app, &cart)?;
    if !dir.join("game.lua").is_file() {
        return Err("this game has no game.lua, so it cannot run (an old plain main.lua game: move its code into a scene)".into());
    }
    stop_locked(&app, &state, false);
    let mut cmd = Command::new(&bin);
    cmd.env("GS_DEV", "1");
    cmd.env("GS_STATS", "1"); // a line of numbers a second for the Handheld panel
    // The Inspector tab talks to the game through this file (engine/gs/inspect.lua reads it); it starts empty for every run.
    let insp = inspect_file();
    let _ = fs::write(&insp, "");
    cmd.env("GS_INSPECT", &insp);
    let listener = match &embed {
        Some(size) => {
            let l = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("could not open the preview connection: {e}"))?;
            cmd.env("GS_EMBED", l.local_addr().map_err(|e| e.to_string())?.port().to_string());
            cmd.env("GS_EMBED_SIZE", format!("{}x{}", size.width.clamp(64, 2048), size.height.clamp(64, 2048)));
            Some(l)
        }
        None => None,
    };
    let mut child = cmd
        .arg(&dir)
        .current_dir(&ws)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start runtime: {e}"))?;
    pipe_lines(app.clone(), child.stdout.take().unwrap(), "stdout");
    pipe_lines(app.clone(), child.stderr.take().unwrap(), "stderr");
    *state.preview.lock().unwrap() = Some(child);
    let gen = {
        let mut g = state.generation.lock().unwrap();
        *g += 1;
        *g
    };
    let _ = app.emit("preview-state", true);
    if let Some(l) = listener {
        relay_frames(app.clone(), l, on_frame, gen);
    }

    // Watch for the game exiting by itself (window closed, Esc, crash).
    let app2 = app.clone();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(250));
        let state = app2.state::<AppState>();
        if *state.generation.lock().unwrap() != gen {
            return; // replaced or stopped explicitly
        }
        let mut guard = state.preview.lock().unwrap();
        match guard.as_mut().map(|c| c.try_wait()) {
            Some(Ok(Some(status))) => {
                *guard = None;
                drop(guard);
                if !status.success() {
                    emit_log(&app2, "stderr", format!("preview exited with {status}"));
                }
                let _ = app2.emit("preview-state", false);
                return;
            }
            Some(Ok(None)) => {}
            _ => return,
        }
    });
    Ok(())
}

fn stop_locked(app: &AppHandle, state: &AppState, notify: bool) {
    *state.generation.lock().unwrap() += 1;
    if let Some(s) = state.embed.lock().unwrap().take() {
        let _ = s.shutdown(Shutdown::Both);
    }
    if let Some(mut child) = state.preview.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    if notify {
        let _ = app.emit("preview-state", false);
    }
}

/// Waits for the game to connect, then passes each frame message on to the page whole ('F', u16 width, u16 height, u32 length, the pixel runs).
fn relay_frames(app: AppHandle, listener: TcpListener, ch: Channel, gen: u64) {
    thread::spawn(move || {
        let _ = listener.set_nonblocking(true);
        let started = std::time::Instant::now();
        let stream = loop {
            if *app.state::<AppState>().generation.lock().unwrap() != gen {
                return; // stopped before it connected
            }
            match listener.accept() {
                Ok((s, _)) => break s,
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock && started.elapsed() < Duration::from_secs(20) => thread::sleep(Duration::from_millis(20)),
                Err(_) => return, // the game failed to start; its stderr says why
            }
        };
        let _ = stream.set_nonblocking(false);
        let _ = stream.set_nodelay(true);
        if let Ok(w) = stream.try_clone() {
            *app.state::<AppState>().embed.lock().unwrap() = Some(w);
        }
        let mut r = BufReader::with_capacity(1 << 20, stream);
        let mut head = [0u8; 9];
        while r.read_exact(&mut head).is_ok() {
            let len = u32::from_le_bytes([head[5], head[6], head[7], head[8]]) as usize;
            if head[0] != b'F' || len > 2048 * 2048 * 5 {
                break; // not a frame: the connection is out of step
            }
            let mut msg = Vec::with_capacity(9 + len);
            msg.extend_from_slice(&head);
            msg.resize(9 + len, 0);
            if r.read_exact(&mut msg[9..]).is_err() || ch.send(InvokeResponseBody::Raw(msg)).is_err() {
                break;
            }
        }
    });
}

/// The buttons held in the preview panel (bit i = the runtime's button i: up, down, left, right, a, b, x, y, l, r, start, select, l2, r2, l3, r3).
#[tauri::command]
fn preview_buttons(state: State<'_, AppState>, mask: u16) {
    if let Some(s) = state.embed.lock().unwrap().as_mut() {
        let _ = s.write_all(&[b'B', mask as u8, (mask >> 8) as u8]);
    }
}

#[tauri::command]
fn stop_preview(app: AppHandle, state: State<'_, AppState>) {
    stop_locked(&app, &state, true);
}

static RENDER_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Render a sound effect or music description (see runtime/main.c, render_audio) to a WAV file with the runtime's own
/// synth, so a preview sounds exactly like the game. Returns the WAV as base64.
#[tauri::command]
async fn render_audio(app: AppHandle, desc: String, cart: Option<String>) -> Result<String, String> {
    if desc.len() > 256 * 1024 {
        return Err("that sound is too large to preview".into());
    }
    let ws = workspace(&app);
    let bin = desktop_bin(&ws);
    if !bin.is_file() {
        return Err(format!("runtime not found at {}. Run scripts/build.sh in the workspace.", bin.display()));
    }
    let dir = std::env::temp_dir().join("gamestudio-render");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let id = format!("{}-{}", std::process::id(), RENDER_COUNTER.fetch_add(1, Ordering::SeqCst));
    let (txt, wav) = (dir.join(format!("{id}.txt")), dir.join(format!("{id}.wav")));
    fs::write(&txt, desc).map_err(|e| e.to_string())?;
    // Run inside the project so imported samples (sounds/...) resolve; the runtime only accepts paths under sounds/.
    let mut cmd = Command::new(&bin);
    cmd.arg("render-audio").arg(&txt).arg(&wav);
    if let Some(c) = cart {
        let d = cart_dir(&app, &c)?;
        if d.is_dir() {
            cmd.current_dir(d);
        }
    }
    let out = cmd.output();
    let _ = fs::remove_file(&txt);
    let out = out.map_err(|e| format!("could not start the runtime: {e}"))?;
    if !out.status.success() {
        let _ = fs::remove_file(&wav);
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    let bytes = fs::read(&wav).map_err(|e| e.to_string());
    let _ = fs::remove_file(&wav);
    Ok(B64.encode(bytes?))
}

#[tauri::command]
async fn pack_cart(app: AppHandle, cart: String) -> Result<String, String> {
    let ws = workspace(&app);
    let bin = desktop_bin(&ws);
    if !bin.is_file() {
        return Err(format!("runtime not found at {}. Run scripts/build.sh in the workspace.", bin.display()));
    }
    let dir = cart_dir(&app, &cart)?;
    let out = ws.join("build").join(format!("{cart}.cart"));
    fs::create_dir_all(ws.join("build")).map_err(|e| e.to_string())?;
    let ok = run_logged(&app, Command::new(&bin).arg("pack").arg(&dir).arg(&out))?;
    if ok { Ok(out.to_string_lossy().into_owned()) } else { Err("packing failed".into()) }
}

/// The file the Inspector's commands go into: one per studio process, so two studios never share it.
fn inspect_file() -> PathBuf {
    std::env::temp_dir().join(format!("gamestudio-inspect-{}.json", std::process::id()))
}

/// The Inspector's request to the running game (pause, step, speed, what to look at), as the JSON text inspector-core.js makes.
#[tauri::command]
fn inspect_send(text: String) -> Result<(), String> {
    if text.len() > 16 * 1024 {
        return Err("inspector request too long".into());
    }
    fs::write(inspect_file(), text).map_err(|e| e.to_string())
}

/// Runs the game without a window for `seconds` and returns its last frame (a BMP, base64) for the Game info screenshot.
/// Saves go to a temporary folder, so taking a picture never touches the player's real saves.
#[tauri::command]
async fn take_screenshot(app: AppHandle, cart: String, seconds: f64) -> Result<String, String> {
    let ws = workspace(&app);
    let bin = desktop_bin(&ws);
    if !bin.is_file() {
        return Err(format!("runtime not found at {}. Run scripts/build.sh in the workspace.", bin.display()));
    }
    let dir = cart_dir(&app, &cart)?;
    if !dir.join("game.lua").is_file() {
        return Err("this game has no game.lua, so it cannot run".into());
    }
    let tmp = std::env::temp_dir().join("gamestudio-shot");
    fs::create_dir_all(tmp.join("saves")).map_err(|e| e.to_string())?;
    let bmp = tmp.join(format!("{cart}.bmp"));
    let _ = fs::remove_file(&bmp);
    let frames = (seconds.clamp(0.1, 30.0) * 60.0).round() as u32;
    let out = Command::new(&bin)
        .arg(&dir)
        .env("SDL_VIDEODRIVER", "dummy")
        .env("SDL_AUDIODRIVER", "dummy")
        .env("GS_SAVE_DIR", tmp.join("saves"))
        .env("GS_MAX_FRAMES", frames.to_string())
        .env("GS_DUMP_FRAME", &bmp)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("could not start the game: {e}"))?;
    let bytes = fs::read(&bmp).map_err(|_| {
        let err = String::from_utf8_lossy(&out.stderr);
        format!("the game did not give a picture{}", if err.trim().is_empty() { String::new() } else { format!(": {}", err.trim()) })
    })?;
    Ok(B64.encode(bytes))
}

fn valid_remote_part(s: &str, extra: &str) -> bool {
    !s.is_empty()
        && !s.starts_with('-')
        && s.chars().all(|c| c.is_ascii_alphanumeric() || extra.contains(c))
}

const SSH_OPTS: [&str; 6] = [
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=8",
    "-o", "StrictHostKeyChecking=accept-new",
];

/// Like `run_logged`, but remembers the child's process id in `slot` while it runs (and starts it in its own process group, so cancelling
/// reaches the ssh and scp that the script started).
fn run_logged_tracked(app: &AppHandle, cmd: &mut Command, slot: &Mutex<Option<u32>>) -> Result<bool, String> {
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    let mut child = cmd.spawn().map_err(|e| format!("could not start {:?}: {e}", cmd.get_program()))?;
    *slot.lock().unwrap() = Some(child.id());
    let out = pipe_lines(app.clone(), child.stdout.take().unwrap(), "stdout");
    let err = pipe_lines(app.clone(), child.stderr.take().unwrap(), "stderr");
    let status = child.wait().map_err(|e| e.to_string());
    *slot.lock().unwrap() = None;
    let _ = out.join();
    let _ = err.join();
    Ok(status?.success())
}

/// Cancel a send that is running: stops `push.sh` and the ssh/scp under it. True if there was one.
#[tauri::command]
fn cancel_push(state: State<'_, AppState>) -> bool {
    let pid = *state.push_pid.lock().unwrap();
    match pid {
        Some(pid) => { let _ = Command::new("kill").args(["-TERM", "--", &format!("-{pid}")]).status(); true }
        None => false,
    }
}

#[tauri::command]
async fn push_cart(app: AppHandle, state: State<'_, AppState>, cart: String) -> Result<(), String> {
    // With scripts/device.env in the workspace, sending is done by scripts/push.sh, so the studio and the command line do exactly the same
    // (launcher in the console's game list, box art and description from "Game info"). It needs node on the PATH; a desktop app does not always
    // inherit the shell's PATH, so the usual places are added.
    let ws = workspace(&app);
    let script = ws.join("scripts").join("push.sh");
    if script.is_file() && ws.join("scripts").join("device.env").is_file() {
        let dir = cart_dir(&app, &cart)?;
        emit_log(&app, "stdout", "Sending with scripts/push.sh (settings from scripts/device.env)".to_string());
        let home = std::env::var("HOME").unwrap_or_default();
        let path = format!(
            "{}:/opt/homebrew/bin:/usr/local/bin:{home}/.asdf/shims:{home}/.volta/bin",
            std::env::var("PATH").unwrap_or_default()
        );
        if !std::env::split_paths(&path).any(|d| d.join("node").is_file()) {
            return Err("Sending needs Node.js (the 'node' program), which was not found. Install it from nodejs.org (or 'brew install node'), then send again.".into());
        }
        let ok = run_logged_tracked(&app, Command::new("sh").arg(&script).arg(&dir).current_dir(&ws).env("PATH", path), &state.push_pid)?;
        return if ok {
            Ok(())
        } else {
            Err("Sending stopped: the output above says why. Most often the connection to the device was closed (it drops when the handheld sleeps): open it again in a terminal as shown, then send again.".into())
        };
    }
    let s = load_settings(&app);
    if !valid_remote_part(&s.device_host, ".-_:") {
        return Err("set a valid device host in Settings".into());
    }
    if !valid_remote_part(&s.device_user, "._-") {
        return Err("set a valid device user in Settings".into());
    }
    if !s.device_dir.starts_with('/') || !valid_remote_part(&s.device_dir[1..], "/._-") || s.device_dir.contains("..") {
        return Err("set an absolute device folder in Settings (letters, digits, / . _ -)".into());
    }
    let ws = workspace(&app);
    let runtime = device_bin(&ws);
    if !runtime.is_file() {
        return Err(format!("device runtime not found at {}. Run scripts/build-aarch64.sh.", runtime.display()));
    }

    let packed = PathBuf::from(pack_cart(app.clone(), cart.clone()).await?);
    let target = format!("{}@{}", s.device_user, s.device_host);
    let dir = s.device_dir.trim_end_matches('/').to_string();
    let step = |what: &str| emit_log(&app, "stdout", what.to_string());

    step(&format!("Preparing {target}:{dir}"));
    let ok = run_logged(&app, Command::new("ssh").args(SSH_OPTS).arg(&target).arg(format!("mkdir -p '{dir}/carts'")))?;
    if !ok {
        return Err("could not reach the device over SSH (is key login set up? try: ssh-copy-id)".into());
    }
    step("Copying runtime");
    if !run_logged(&app, Command::new("scp").arg("-q").args(SSH_OPTS).arg(&runtime).arg(format!("{target}:{dir}/gs")))? {
        return Err("copying the runtime failed".into());
    }
    // The General MIDI SoundFont (about 6 MB) goes once, beside the runtime: it is not packed into each game.
    let font = ws.join("assets").join("soundfonts").join("TimGM6mb.sf2");
    if font.is_file() {
        let have = run_logged(&app, Command::new("ssh").args(SSH_OPTS).arg(&target).arg(format!("test -f '{dir}/TimGM6mb.sf2'")))?;
        if !have {
            step("Copying the General MIDI SoundFont (once)");
            if !run_logged(&app, Command::new("scp").arg("-q").args(SSH_OPTS).arg(&font).arg(format!("{target}:{dir}/TimGM6mb.sf2")))? {
                return Err("copying the SoundFont failed".into());
            }
        }
    }
    step("Copying game");
    if !run_logged(&app, Command::new("scp").arg("-q").args(SSH_OPTS).arg(&packed).arg(format!("{target}:{dir}/carts/{cart}.cart")))? {
        return Err("copying the game failed".into());
    }
    if !run_logged(&app, Command::new("ssh").args(SSH_OPTS).arg(&target).arg(format!("chmod +x '{dir}/gs'")))? {
        return Err("could not mark the runtime executable".into());
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .manage(lsp::LspState::default())
        .invoke_handler(tauri::generate_handler![
            lsp::lsp_start,
            lsp::lsp_send,
            lsp::lsp_stop,
            get_settings,
            save_settings,
            preview_buttons,
            runtime_status,
            list_carts,
            list_games,
            list_consoles,
            save_console,
            delete_console,
            list_files,
            read_file,
            write_file,
            take_screenshot,
            inspect_send,
            new_cart,
            new_file,
            read_binary,
            write_binary,
            cart_size,
            delete_file,
            rename_file,
            run_preview,
            stop_preview,
            cancel_push,
            render_audio,
            pack_cart,
            push_cart,
        ])
        .build(tauri::generate_context!())
        .expect("error while building GameStudio")
        .run(|app, event| {
            // the language server must not outlive the studio
            if let tauri::RunEvent::Exit = event {
                lsp::stop(&app.state::<lsp::LspState>());
            }
        });
}
