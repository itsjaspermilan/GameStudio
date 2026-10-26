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

/// Inside the built app (scripts/build-app.sh): its own read-only copy of the GameStudio folder, with the runtimes, the SoundFont, the
/// console specs and logos, push.sh and the examples. The app then needs nothing from the repository; in development there is none and
/// the workspace from Settings (the repository) is used.
fn bundled_root(app: &AppHandle) -> Option<PathBuf> {
    let root = app.path().resource_dir().ok()?.join("gamestudio");
    root.join("build").join("gs").is_file().then_some(root)
}

fn workspace(app: &AppHandle) -> PathBuf {
    bundled_root(app).unwrap_or_else(|| PathBuf::from(load_settings(app).workspace))
}

/// Where the studio writes files of its own (packed copies on their way to the device, the language server's settings): the
/// workspace's build folder in development, the app's cache folder in the built app, whose bundled copy cannot be written to.
pub fn scratch_dir(app: &AppHandle) -> PathBuf {
    if bundled_root(app).is_some() {
        if let Ok(dir) = app.path().app_cache_dir() {
            return dir;
        }
    }
    workspace(app).join("build")
}

/// The person's own consoles: the workspace's consoles folder in development, the app's data folder in the built app.
fn consoles_dir(app: &AppHandle) -> PathBuf {
    if bundled_root(app).is_some() {
        if let Ok(dir) = app.path().app_data_dir() {
            return dir.join("consoles");
        }
    }
    workspace(app).join("consoles")
}

/// The desktop runtime, told where the General MIDI SoundFont is (SDL's idea of the program's folder inside an app bundle is the
/// bundle's, not the runtime's own).
fn runtime_command(ws: &Path, bin: &Path) -> Command {
    let mut cmd = Command::new(bin);
    let font = ws.join("assets").join("soundfonts").join("TimGM6mb.sf2");
    if font.is_file() {
        cmd.env("GS_SOUNDFONT", font);
    }
    cmd
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

/// A game is named by its folder. The front end passes either the absolute path of a folder the person opened or made
/// (it must be in the list of projects, so the page can never reach a folder they did not choose), or, for the
/// workspace's own samples and the tests, a plain name in `<workspace>/carts/`.
fn cart_dir(app: &AppHandle, cart: &str) -> Result<PathBuf, String> {
    if valid_name(cart) {
        return Ok(workspace(app).join("carts").join(cart));
    }
    let path = PathBuf::from(cart);
    if path.is_absolute() && load_projects(app).iter().any(|p| p == cart) {
        return Ok(path);
    }
    Err("that game's folder is not open in the studio (open it with Open folder)".into())
}

/// The name shown for a game and used for its packed cartridge: its folder's name.
fn cart_label(cart: &str) -> String {
    let name = Path::new(cart).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let clean: String = name.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' }).collect();
    if clean.is_empty() { "game".into() } else { clean }
}

// ---------- projects (game folders anywhere on disk, like folders opened in a code editor) ----------
// The list of folders opened lately is kept beside the settings, newest first. A game's folder holds only the game;
// what the studio remembers about it (open tabs, where you were) is in <folder>/.gamestudio/, which is never packed.

fn projects_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("projects.json"))
}

fn load_projects(app: &AppHandle) -> Vec<String> {
    projects_path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn save_projects(app: &AppHandle, list: &[String]) -> Result<(), String> {
    let path = projects_path(app)?;
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(path, serde_json::to_string_pretty(list).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

fn remember_project(app: &AppHandle, dir: &Path) -> Result<String, String> {
    let path = dir.to_string_lossy().into_owned();
    let mut list = load_projects(app);
    list.retain(|p| p != &path);
    list.insert(0, path.clone());
    list.truncate(30);
    save_projects(app, &list)?;
    Ok(path)
}

/// Where new games go unless the person picks another place: Documents/GameStudio.
fn games_home(app: &AppHandle) -> PathBuf {
    app.path().document_dir().unwrap_or_else(|_| std::env::temp_dir()).join("GameStudio")
}

#[derive(Serialize)]
struct ProjectInfo {
    /// The folder's absolute path: the id every other command takes as `cart`.
    path: String,
    name: String,
    kind: &'static str,
}

/// The games opened lately that are still there, newest first.
#[tauri::command]
fn list_projects(app: AppHandle) -> Vec<ProjectInfo> {
    load_projects(&app)
        .into_iter()
        .filter(|p| Path::new(p).is_dir())
        .map(|p| {
            let kind = if Path::new(&p).join("game.lua").is_file() { "game" } else { "lua" };
            ProjectInfo { name: cart_label(&p), kind, path: p }
        })
        .collect()
}

#[tauri::command]
fn forget_project(app: AppHandle, path: String) -> Result<(), String> {
    let mut list = load_projects(&app);
    list.retain(|p| p != &path);
    save_projects(&app, &list)
}

fn pick_folder(app: &AppHandle, title: &str, start: Option<PathBuf>) -> Option<PathBuf> {
    use tauri_plugin_dialog::DialogExt;
    let mut d = app.dialog().file().set_title(title);
    if let Some(dir) = start {
        let _ = fs::create_dir_all(&dir);
        d = d.set_directory(dir);
    }
    d.blocking_pick_folder().and_then(|f| f.into_path().ok())
}

/// Open folder: any folder becomes the open game (an empty one can be given a game with New game files). None if cancelled.
#[tauri::command]
async fn open_folder(app: AppHandle) -> Result<Option<String>, String> {
    match pick_folder(&app, "Open a game folder", Some(games_home(&app))) {
        Some(dir) => Ok(Some(remember_project(&app, &dir)?)),
        None => Ok(None),
    }
}

/// Asks where a new game's folder should go (Documents/GameStudio to start with) and makes `<there>/<name>`. None if cancelled.
#[tauri::command]
async fn new_project(app: AppHandle, name: String) -> Result<Option<String>, String> {
    if !valid_name(&name) {
        return Err("use letters, digits, - and _ for the name".into());
    }
    let Some(parent) = pick_folder(&app, &format!("Where should the folder '{name}' go?"), Some(games_home(&app))) else {
        return Ok(None);
    };
    let dir = parent.join(&name);
    if dir.exists() {
        return Err(format!("there is already a '{name}' in {}", parent.display()));
    }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(Some(remember_project(&app, &dir)?))
}

fn copy_tree(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|e| e.to_string())?;
    for e in fs::read_dir(from).map_err(|e| e.to_string())?.filter_map(|e| e.ok()) {
        let name = e.file_name();
        if name.to_string_lossy().starts_with('.') {
            continue;
        }
        let (a, b) = (e.path(), to.join(&name));
        if a.is_dir() { copy_tree(&a, &b)? } else { fs::copy(&a, &b).map(|_| ()).map_err(|e| e.to_string())? }
    }
    Ok(())
}

/// The finished examples that come with the studio (`<workspace>/carts/<name>` with a game.lua).
#[tauri::command]
fn list_examples(app: AppHandle) -> Result<Vec<String>, String> {
    let root = workspace(&app).join("carts");
    Ok(list_carts(app)?.into_iter().filter(|n| root.join(n).join("game.lua").is_file()).collect())
}

/// An example is copied into a folder of the person's own before it opens, so changing it never changes the original.
/// A copy made before is opened again instead of copied twice.
#[tauri::command]
async fn copy_example(app: AppHandle, name: String) -> Result<Option<String>, String> {
    let from = cart_dir(&app, &name)?;
    if !from.join("game.lua").is_file() {
        return Err(format!("there is no example called {name}"));
    }
    let Some(parent) = pick_folder(&app, &format!("Where should your copy of '{name}' go?"), Some(games_home(&app))) else {
        return Ok(None);
    };
    let dir = parent.join(&name);
    if !dir.join("game.lua").is_file() {
        if dir.exists() {
            return Err(format!("there is already a '{name}' in {} that is not a game", parent.display()));
        }
        copy_tree(&from, &dir)?;
    }
    Ok(Some(remember_project(&app, &dir)?))
}

/// What the studio remembers about one game (open tabs, the file you were in), in <folder>/.gamestudio/state.json.
#[tauri::command]
fn read_project_state(app: AppHandle, cart: String) -> Result<String, String> {
    Ok(fs::read_to_string(cart_dir(&app, &cart)?.join(".gamestudio").join("state.json")).unwrap_or_default())
}

#[tauri::command]
fn write_project_state(app: AppHandle, cart: String, content: String) -> Result<(), String> {
    if content.len() > 256 * 1024 {
        return Err("project state too large".into());
    }
    let dir = cart_dir(&app, &cart)?.join(".gamestudio");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    // a note for anyone who finds the folder, as editors do with theirs
    let readme = dir.join("README.txt");
    if !readme.exists() {
        let _ = fs::write(&readme, "GameStudio keeps its notes about this game here (open tabs, where you were).\nIt is not part of the game and is never packed; it is safe to delete.\n");
    }
    // the folder leaves itself out of git, so a game kept in a repository never commits it, without touching the game's own .gitignore
    let ignore = dir.join(".gitignore");
    if !ignore.exists() {
        let _ = fs::write(&ignore, "# GameStudio's notes about this game, not part of it\n*\n");
    }
    fs::write(dir.join("state.json"), content).map_err(|e| e.to_string())
}

/// Shows the game's folder in Finder (Explorer, the file manager).
#[tauri::command]
fn reveal_project(app: AppHandle, cart: String) -> Result<(), String> {
    let dir = cart_dir(&app, &cart)?;
    let opener = if cfg!(target_os = "macos") { "open" } else if cfg!(windows) { "explorer" } else { "xdg-open" };
    Command::new(opener).arg(&dir).spawn().map(|_| ()).map_err(|e| e.to_string())
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
    let dir = consoles_dir(&app);
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
    let dir = consoles_dir(&app);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())? + "\n";
    fs::write(dir.join(format!("{id}.json")), text).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_console(app: AppHandle, id: String) -> Result<(), String> {
    if !valid_console_id(&id) || RESERVED_CONSOLES.contains(&id.as_str()) {
        return Err("that console can't be deleted".into());
    }
    let path = consoles_dir(&app).join(format!("{id}.json"));
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
    let mut cmd = runtime_command(&ws, &bin);
    cmd.env("GS_DEV", "1");
    cmd.env("GS_STATS", "1"); // a line of numbers a second for the Handheld panel
    // Lua gets the handheld's fixed RAM (runtime/ram.c), so a game runs out of memory here where it would there, and can save states
    cmd.env("GS_RAM", "1");
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

/// Save state (`save`) or load it again: one state a run, kept by the game itself (runtime/main.c, "embedded preview"); it says in the
/// Output what happened.
#[tauri::command]
fn preview_state(state: State<'_, AppState>, save: bool) {
    if let Some(s) = state.embed.lock().unwrap().as_mut() {
        let _ = s.write_all(if save { b"S" } else { b"L" });
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
    let mut cmd = runtime_command(&ws, &bin);
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
async fn pack_cart(app: AppHandle, cart: String, ext: Option<String>) -> Result<String, String> {
    let dir = cart_dir(&app, &cart)?;
    // Named for the console (breakout.g43, like breakout.gba) and put beside the game's folder, where its maker finds it; inside the folder
    // it would be packed into the next game file too.
    let ext = ext.filter(|e| !e.is_empty() && e.len() <= 8 && e.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())).unwrap_or_else(|| "cart".into());
    let parent = dir.parent().ok_or("the game's folder has no folder around it")?.to_path_buf();
    let out = parent.join(format!("{}.{}", cart_label(&cart), ext));
    pack_into(&app, &dir, &out)
}

/// Packs a game's folder into one file with the runtime (`gs pack`).
fn pack_into(app: &AppHandle, dir: &Path, out: &Path) -> Result<String, String> {
    let ws = workspace(app);
    let bin = desktop_bin(&ws);
    if !bin.is_file() {
        return Err(format!("runtime not found at {}. Run scripts/build.sh in the workspace.", bin.display()));
    }
    let ok = run_logged(app, runtime_command(&ws, &bin).arg("pack").arg(dir).arg(out))?;
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
    let bmp = tmp.join(format!("{}.bmp", cart_label(&cart)));
    let _ = fs::remove_file(&bmp);
    let frames = (seconds.clamp(0.1, 30.0) * 60.0).round() as u32;
    let out = runtime_command(&ws, &bin)
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

/// Like `run_logged`, but remembers the child's process id in `slot` while it runs (and starts it in its own process group, so cancelling
/// reaches the ssh and scp that the script started).
/// Returns the exit code (None when a signal stopped it).
fn run_logged_code(app: &AppHandle, cmd: &mut Command, slot: &Mutex<Option<u32>>) -> Result<Option<i32>, String> {
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
    Ok(status?.code())
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
    // Sending is always scripts/push.sh, so the studio and the command line do exactly the same (on the Brick: the console as a NextUI
    // system run by its emulator, box art and title from "Game info"). The studio writes the device file from Settings (NextUI, the
    // Brick) into its own folder. Only when Settings has no address does a scripts/device.env in the workspace say where (the command
    // line's file; in a checkout it may still be the old Knulli handheld, which is why Settings comes first). It needs node on the PATH;
    // a desktop app does not always inherit the shell's PATH, so the usual places are added.
    let ws = workspace(&app);
    let script = ws.join("scripts").join("push.sh");
    if !script.is_file() {
        return Err(format!("scripts/push.sh not found in {}", ws.display()));
    }
    let scratch = scratch_dir(&app);
    let mut env_file = ws.join("scripts").join("device.env");
    let s = load_settings(&app);
    if !s.device_host.is_empty() || !env_file.is_file() {
        if s.device_host.is_empty() || !valid_remote_part(&s.device_host, ".-_:") {
            return Err("set the handheld's address (its IP) in Settings first".into());
        }
        if !valid_remote_part(&s.device_user, "._-") {
            return Err("set a valid device user in Settings".into());
        }
        let dir = if s.device_dir.is_empty() { "/mnt/SDCARD/GameStudio".to_string() } else { s.device_dir.clone() };
        if !dir.starts_with('/') || !valid_remote_part(&dir[1..], "/._-") || dir.contains("..") {
            return Err("set an absolute device folder in Settings (letters, digits, / . _ -)".into());
        }
        // One shared SSH connection the person opens once in a terminal (push.sh prints the command when it is not open): the
        // handheld's password is never typed into the studio.
        let text = format!(
            "# written by GameStudio from its Settings\nDEVICE_OS=nextui\nDEVICE_HOST={}\nDEVICE_USER={}\nDEVICE_DIR={}\nSSH_OPTS=\"-o ControlPath=$HOME/.ssh/gamestudio-%r@%h\"\n",
            s.device_host, s.device_user, dir
        );
        fs::create_dir_all(&scratch).map_err(|e| e.to_string())?;
        env_file = scratch.join("device.env");
        fs::write(&env_file, text).map_err(|e| e.to_string())?;
    }
    let dir = cart_dir(&app, &cart)?;
    emit_log(&app, "stdout", format!("Sending with scripts/push.sh (settings from {})", env_file.display()));
    let home = std::env::var("HOME").unwrap_or_default();
    let path = format!(
        "{}:/opt/homebrew/bin:/usr/local/bin:{home}/.asdf/shims:{home}/.volta/bin",
        std::env::var("PATH").unwrap_or_default()
    );
    if !std::env::split_paths(&path).any(|d| d.join("node").is_file()) {
        return Err("Sending needs Node.js (the 'node' program), which was not found. Install it from nodejs.org (or 'brew install node'), then send again.".into());
    }
    let code = run_logged_code(
        &app,
        Command::new("sh").arg(&script).arg(&dir).current_dir(&ws).env("PATH", path).env("DEVICE_ENV", &env_file).env("GS_BUILD_DIR", scratch.join("push")),
        &state.push_pid,
    )?;
    match code {
        Some(0) => Ok(()),
        // push.sh could reach the handheld but not log in without a password: the studio offers to set the key up (setup_device_key)
        Some(3) => Err(format!("NEEDS_KEY {}@{}", s.device_user, s.device_host)),
        _ => Err("Sending stopped: the output above says why.".into()),
    }
}

/// Open Terminal on scripts/setup-key.sh for the handheld in Settings: it makes GameStudio's SSH key if needed and puts it on the
/// handheld, asking for the handheld's password there (never in the studio). macOS only; elsewhere the error says what to run.
#[tauri::command]
fn setup_device_key(app: AppHandle) -> Result<(), String> {
    let s = load_settings(&app);
    if s.device_host.is_empty() || !valid_remote_part(&s.device_host, ".-_:") || !valid_remote_part(&s.device_user, "._-") {
        return Err("set the handheld's address (its IP) and user in Settings first".into());
    }
    let script = workspace(&app).join("scripts").join("setup-key.sh");
    if !script.is_file() {
        return Err(format!("scripts/setup-key.sh not found in {}", workspace(&app).display()));
    }
    let target = format!("{}@{}", s.device_user, s.device_host);
    if !cfg!(target_os = "macos") {
        return Err(format!("open a terminal and run: sh \"{}\" {}", script.display(), target));
    }
    // a .command file opens in Terminal and runs; it holds no secret, only the script's path and the handheld's address
    let scratch = scratch_dir(&app);
    fs::create_dir_all(&scratch).map_err(|e| e.to_string())?;
    let cmd_file = scratch.join("setup-key.command");
    let quoted = script.display().to_string().replace('\'', "'\\''");
    fs::write(&cmd_file, format!("#!/bin/sh\nclear\nsh '{quoted}' {target}\n")).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&cmd_file, fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
    }
    Command::new("open").arg("-a").arg("Terminal").arg(&cmd_file).status().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        // closing the studio quits, even with the Help window still open beside it
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                window.app_handle().exit(0);
            }
        })
        .manage(lsp::LspState::default())
        .invoke_handler(tauri::generate_handler![
            lsp::lsp_start,
            lsp::lsp_send,
            lsp::lsp_stop,
            get_settings,
            setup_device_key,
            save_settings,
            preview_buttons,
            preview_state,
            runtime_status,
            list_carts,
            list_games,
            list_projects,
            forget_project,
            open_folder,
            new_project,
            list_examples,
            copy_example,
            read_project_state,
            write_project_state,
            reveal_project,
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
