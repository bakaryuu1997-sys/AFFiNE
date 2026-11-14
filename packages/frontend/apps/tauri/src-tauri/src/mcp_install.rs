use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct McpClientStatus {
  pub client_id: String,
  pub client_name: String,
  pub installed: bool,
  pub config_path: Option<String>,
  pub executable_path: String,
  pub client_type: String,
  pub manual_command: Option<String>,
}

pub struct McpClient {
  pub id: &'static str,
  pub name: &'static str,
  pub config_path: Option<PathBuf>,
  pub client_type: &'static str,
}

fn get_base_dirs() -> (Option<PathBuf>, Option<PathBuf>) {
  let home = std::env::var_os("USERPROFILE")
    .or_else(|| std::env::var_os("HOME"))
    .map(PathBuf::from);
  let appdata = std::env::var_os("APPDATA").map(PathBuf::from).or_else(|| home.clone());
  (home, appdata)
}

pub fn get_all_clients() -> Vec<McpClient> {
  #[allow(unused_variables)]
  let (home, appdata) = get_base_dirs();

  let claude_path = {
    #[cfg(target_os = "macos")]
    {
      home
        .as_ref()
        .map(|h| h.join("Library/Application Support/Claude/claude_desktop_config.json"))
    }
    #[cfg(target_os = "windows")]
    {
      appdata.as_ref().map(|a| a.join("Claude/claude_desktop_config.json"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
      home
        .as_ref()
        .map(|h| h.join(".config/Claude/claude_desktop_config.json"))
    }
  };

  let claude_code_path = home.as_ref().map(|h| h.join(".claude.json"));
  let codex_path = home.as_ref().map(|h| h.join(".codex/config.toml"));
  let cursor_path = home.as_ref().map(|h| h.join(".cursor/mcp.json"));
  let windsurf_path = home.as_ref().map(|h| h.join(".codeium/windsurf/mcp_config.json"));
  let antigravity_path = home.as_ref().map(|h| h.join(".gemini/antigravity/mcp_config.json"));

  vec![
    McpClient {
      id: "claude",
      name: "Claude Desktop",
      config_path: claude_path,
      client_type: "file",
    },
    McpClient {
      id: "claude_code",
      name: "Claude Code",
      config_path: claude_code_path,
      client_type: "command",
    },
    McpClient {
      id: "codex",
      name: "Codex",
      config_path: codex_path,
      client_type: "command",
    },
    McpClient {
      id: "cursor",
      name: "Cursor",
      config_path: cursor_path,
      client_type: "file",
    },
    McpClient {
      id: "windsurf",
      name: "Windsurf",
      config_path: windsurf_path,
      client_type: "file",
    },
    McpClient {
      id: "antigravity",
      name: "Antigravity",
      config_path: antigravity_path,
      client_type: "file",
    },
  ]
}

fn is_affine_in_mcp_servers(path: &PathBuf) -> bool {
  if !path.exists() {
    return false;
  }
  fs::read_to_string(path)
    .ok()
    .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
    .and_then(|j| j.get("mcpServers").cloned())
    .map(|s| s.get("affine").is_some() || s.get("affine-mcp").is_some())
    .unwrap_or(false)
}

fn is_command_client_installed(path: &PathBuf) -> bool {
  if !path.exists() {
    return false;
  }
  fs::read_to_string(path)
    .map(|c| {
      c.contains("\"affine\"")
        || c.contains("\"affine-mcp\"")
        || c.contains("[mcp_servers.affine]")
        || c.contains("[mcp_servers.\"affine\"]")
    })
    .unwrap_or(false)
}

fn build_manual_command(client_id: &str, exe_str: &str) -> Option<String> {
  match client_id {
    "claude_code" => Some(format!("claude mcp add --scope user affine \"{exe_str}\" -- --mcp")),
    "codex" => Some(format!("codex mcp add affine -- \"{exe_str}\" --mcp")),
    _ => None,
  }
}

#[tauri::command]
pub fn get_mcp_status() -> Result<Vec<McpClientStatus>, String> {
  let exe_path = std::env::current_exe()
    .map_err(|e| format!("Không lấy được đường dẫn tệp thực thi: {e}"))?
    .to_string_lossy()
    .to_string();

  let clients = get_all_clients();
  let statuses = clients
    .into_iter()
    .map(|c| {
      let installed = match c.client_type {
        "command" => c
          .config_path
          .as_ref()
          .map(|p| is_command_client_installed(p))
          .unwrap_or(false),
        _ => c
          .config_path
          .as_ref()
          .map(|p| is_affine_in_mcp_servers(p))
          .unwrap_or(false),
      };

      McpClientStatus {
        client_id: c.id.to_string(),
        client_name: c.name.to_string(),
        installed,
        config_path: c.config_path.map(|p| p.to_string_lossy().to_string()),
        executable_path: exe_path.clone(),
        client_type: c.client_type.to_string(),
        manual_command: build_manual_command(c.id, &exe_path),
      }
    })
    .collect();

  Ok(statuses)
}

#[tauri::command]
pub fn install_mcp_config(client_id: String) -> Result<String, String> {
  let exe_path = std::env::current_exe().map_err(|e| format!("Không lấy được đường dẫn tệp thực thi: {e}"))?;
  let exe_str = exe_path.to_string_lossy().to_string();

  let clients = get_all_clients();
  let client = clients
    .iter()
    .find(|c| c.id == client_id)
    .ok_or_else(|| format!("Client không xác định: {client_id}"))?;

  if client.id == "claude_code" {
    // Try running claude CLI
    let output = std::process::Command::new("claude")
      .args(["mcp", "add", "--scope", "user", "affine", &exe_str, "--", "--mcp"])
      .output();
    if let Ok(out) = output {
      if out.status.success() {
        return Ok(client.name.to_string());
      }
    }
    // Fallback: write directly to ~/.claude.json
    if let Some(config_path) = &client.config_path {
      if let Some(parent) = config_path.parent() {
        let _ = fs::create_dir_all(parent);
      }
      let mut config: serde_json::Value = if config_path.exists() {
        let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(json!({}))
      } else {
        json!({})
      };
      if config.get("mcpServers").is_none() {
        config["mcpServers"] = json!({});
      }
      config["mcpServers"]["affine"] = json!({
        "command": exe_str,
        "args": ["--mcp"]
      });
      let new_content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
      fs::write(config_path, new_content).map_err(|e| e.to_string())?;
      return Ok(client.name.to_string());
    }
  }

  if client.id == "codex" {
    let output = std::process::Command::new("codex")
      .args(["mcp", "add", "affine", "--", &exe_str, "--mcp"])
      .output();
    if let Ok(out) = output {
      if out.status.success() {
        return Ok(client.name.to_string());
      }
    }
    if let Some(config_path) = &client.config_path {
      if let Some(parent) = config_path.parent() {
        let _ = fs::create_dir_all(parent);
      }
      let existing = fs::read_to_string(config_path).unwrap_or_default();
      if !existing.contains("[mcp_servers.affine]") {
        let entry = format!(
          "\n[mcp_servers.affine]\ncommand = \"{}\"\nargs = [\"--mcp\"]\n",
          exe_str.replace('\\', "\\\\")
        );
        let mut new_content = existing;
        new_content.push_str(&entry);
        fs::write(config_path, new_content).map_err(|e| e.to_string())?;
      }
      return Ok(client.name.to_string());
    }
  }

  // File-based clients (Claude Desktop, Cursor, Windsurf, Antigravity)
  let config_path = client
    .config_path
    .as_ref()
    .ok_or_else(|| "Không xác định được đường dẫn cấu hình trên hệ điều hành này".to_string())?;

  if let Some(parent) = config_path.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }

  let mut config: serde_json::Value = if config_path.exists() {
    let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).unwrap_or(json!({}))
  } else {
    json!({})
  };

  if config.get("mcpServers").is_none() {
    config["mcpServers"] = json!({});
  }

  config["mcpServers"]["affine"] = json!({
    "command": exe_str,
    "args": ["--mcp"]
  });

  let new_content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
  fs::write(config_path, new_content).map_err(|e| e.to_string())?;

  Ok(client.name.to_string())
}
