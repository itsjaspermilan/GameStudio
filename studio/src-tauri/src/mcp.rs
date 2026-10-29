use serde_json::{json, Value};
use std::{fs, path::Path};

/// Keep the person's servers, including a GameStudio entry they have already configured.
pub fn setup_project(dir: &Path, workspace: &Path) -> Result<(), String> {
    let path = dir.join(".mcp.json");
    let mut config: Value = match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!(".mcp.json: {e}"))?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => json!({}),
        Err(e) => return Err(format!(".mcp.json: {e}")),
    };
    let object = config.as_object_mut().ok_or(".mcp.json must contain a JSON object")?;
    let servers = object.entry("mcpServers").or_insert_with(|| json!({}))
        .as_object_mut().ok_or(".mcp.json: mcpServers must be a JSON object")?;
    if servers.contains_key("gamestudio") {
        return Ok(());
    }
    let workspace = fs::canonicalize(workspace).map_err(|e| format!("GameStudio tools folder: {e}"))?;
    let server = workspace.join("tools").join("mcp").join("server.mjs");
    if !server.is_file() {
        return Err(format!("GameStudio MCP server is missing from {}. Use an app built with scripts/build-app.sh or choose a GameStudio source folder in Settings.", workspace.display()));
    }
    let node = workspace.join("tools/mcp/node");
    let launcher = workspace.join("tools/mcp/gamestudio-mcp");
    let entry = if node.is_file() {
        if !launcher.is_file() {
            return Err("The bundled GameStudio MCP launcher is missing. Rebuild or reinstall GameStudio.".into());
        }
        json!({ "command": launcher })
    } else {
        json!({
            "command": "node",
            "args": [server],
            "env": { "GS_WORKSPACE": workspace },
        })
    };
    servers.insert("gamestudio".into(), entry);
    let text = serde_json::to_string_pretty(&config).map_err(|e| format!(".mcp.json: {e}"))? + "\n";
    fs::write(&path, text).map_err(|e| format!(".mcp.json: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT: AtomicU64 = AtomicU64::new(0);

    struct Fixture(std::path::PathBuf);
    impl Fixture {
        fn new() -> Self {
            let dir = std::env::temp_dir().join(format!("gs-mcp-{}-{}", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)));
            fs::create_dir_all(dir.join("Game Studio/tools/mcp")).unwrap();
            fs::create_dir_all(dir.join("My Game")).unwrap();
            fs::write(dir.join("Game Studio/tools/mcp/server.mjs"), "").unwrap();
            Self(dir)
        }
        fn setup(&self) -> Result<(), String> {
            setup_project(&self.0.join("My Game"), &self.0.join("Game Studio"))
        }
        fn config(&self) -> std::path::PathBuf { self.0.join("My Game/.mcp.json") }
    }
    impl Drop for Fixture {
        fn drop(&mut self) { fs::remove_dir_all(&self.0).unwrap(); }
    }

    #[test]
    fn generates_absolute_paths_with_spaces_and_engine_workspace() {
        let f = Fixture::new();
        f.setup().unwrap();
        let config: Value = serde_json::from_str(&fs::read_to_string(f.config()).unwrap()).unwrap();
        let ws = fs::canonicalize(f.0.join("Game Studio")).unwrap();
        assert_eq!(config, json!({ "mcpServers": { "gamestudio": {
            "command": "node",
            "args": [ws.join("tools/mcp/server.mjs")],
            "env": { "GS_WORKSPACE": ws },
        } } }));
    }

    #[test]
    fn packaged_projects_use_the_bundled_launcher_instead_of_system_node() {
        let f = Fixture::new();
        let tools = f.0.join("Game Studio/tools/mcp");
        fs::write(tools.join("node"), "").unwrap();
        fs::write(tools.join("gamestudio-mcp"), "").unwrap();
        f.setup().unwrap();
        let config: Value = serde_json::from_str(&fs::read_to_string(f.config()).unwrap()).unwrap();
        assert_eq!(config["mcpServers"]["gamestudio"], json!({
            "command": fs::canonicalize(tools.join("gamestudio-mcp")).unwrap(),
        }));
    }

    #[test]
    fn incomplete_bundles_do_not_fall_back_to_system_node() {
        let f = Fixture::new();
        fs::write(f.0.join("Game Studio/tools/mcp/node"), "").unwrap();
        assert!(f.setup().unwrap_err().contains("launcher is missing"));
        assert!(!f.config().exists());
    }

    #[test]
    fn adds_only_the_missing_server_and_preserves_existing_entries() {
        let f = Fixture::new();
        fs::write(f.config(), r#"{"note":"keep","mcpServers":{"other":{"command":"custom","args":["a b"]}}}"#).unwrap();
        f.setup().unwrap();
        let text = fs::read_to_string(f.config()).unwrap();
        let config: Value = serde_json::from_str(&text).unwrap();
        assert_eq!(config["note"], "keep");
        assert_eq!(config["mcpServers"]["other"], json!({"command":"custom","args":["a b"]}));
        f.setup().unwrap();
        assert_eq!(fs::read_to_string(f.config()).unwrap(), text);
        let custom = "{ \"mcpServers\": { \"gamestudio\": { \"command\": \"my-server\" } } }\n";
        fs::write(f.config(), custom).unwrap();
        f.setup().unwrap();
        assert_eq!(fs::read_to_string(f.config()).unwrap(), custom);
    }

    #[test]
    fn malformed_configs_and_missing_servers_are_reported_without_overwriting() {
        let f = Fixture::new();
        for text in ["{bad", "[]", r#"{"mcpServers":[]}"#] {
            fs::write(f.config(), text).unwrap();
            assert!(f.setup().unwrap_err().contains(".mcp.json"));
            assert_eq!(fs::read_to_string(f.config()).unwrap(), text);
        }
        fs::remove_file(f.config()).unwrap();
        fs::remove_file(f.0.join("Game Studio/tools/mcp/server.mjs")).unwrap();
        assert!(f.setup().unwrap_err().contains("MCP server is missing"));
        assert!(!f.config().exists());
    }
}
