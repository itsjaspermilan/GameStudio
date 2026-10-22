# studio/src-tauri/: the Rust back end

Two files matter: `src/lib.rs` (~700 lines) and `src/lsp.rs` (the Lua language server helper process); `main.rs` just calls `run()`. Config: `tauri.conf.json`, `capabilities/default.json`. `target/` and `gen/` are build output. `cargo check` here after edits.

**Workspace:** the folder that holds `carts/`, `build/gs`, `build-aarch64/gs`, `consoles/` and `assets/`. Default is the repo root (two levels above this crate); changeable in Settings. A *cart* is
`<workspace>/carts/<name>/`.

Commands (all `#[tauri::command]`, registered in `generate_handler!` near the bottom; each has a twin in `../src/mock-backend.js`):
settings (`get_settings`, `save_settings`, `runtime_status`) · consoles (`list_consoles`, `save_console`, `delete_console`) · games (`list_carts`, `list_games`, `list_files`, `new_cart`, `new_file`, `cart_size`)
· files (`read_file`, `write_file`, `read_binary`, `write_binary`, `rename_file`, `delete_file`) · run (`run_preview(cart, embed, on_frame)` (starts the game with `GS_DEV=1`, so live reload is on; with `embed` = the console's screen it has no window and its frames come through the `on_frame` Channel, see `relay_frames`), `preview_buttons(mask)` (the keys held in the Play panel), `stop_preview`, emits `log` and `preview-state` events)
· Lua language server (`lsp_start(cart)` returns the game's absolute folder, `lsp_send(message)` writes one JSON message, `lsp_stop`; every server message comes back as an `lsp-message` event; the process is killed when the app exits; see `../src/lua-server.js`) · audio (`render_audio(desc, cart)` runs `build/gs render-audio` with the cart as working directory so `sounds/...` samples resolve) · `pack_cart` · `push_cart` (with `scripts/device.env` present it runs `scripts/push.sh`, the same as the command line: runtime, SoundFont once, cart, launcher, game list entry and box art; otherwise it does its own plain ssh/scp of runtime, SoundFont and cart).

Rules: every path from the front end goes through `valid_name` / `safe_rel` (no `..`, no absolute paths, restricted characters). Anything that spawns a process pipes stdout/stderr as `log` events
(`run_logged`). `new_cart` only makes the folder: the starter files come from `src/project-core.js` (`newGameFiles`). The project is its folder (no index file), so a new resource group
is a `GROUPS` entry there, not a Rust change.
