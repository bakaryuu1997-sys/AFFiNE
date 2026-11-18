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

/// Merges the AFFiNE MCP entry into an existing JSON config without overwriting
/// corrupt or non-object config files. Returns an error on invalid JSON.
pub fn merge_mcp_json_config(
  existing_content: Option<&str>,
  exe_str: &str,
) -> Result<String, String> {
  let mut config: serde_json::Value = match existing_content {
    Some(raw) if !raw.trim().is_empty() => serde_json::from_str(raw).map_err(|e| {
      format!(
        "Tệp cấu hình JSON hiện có bị lỗi cú pháp ({e}). Đã dừng lại và giữ nguyên tệp gốc để tránh mất dữ liệu."
      )
    })?,
    _ => json!({}),
  };

  let root = config.as_object_mut().ok_or_else(|| {
    "Tệp cấu hình hiện có không phải là một JSON object hợp lệ. Đã dừng lại và giữ nguyên tệp gốc."
      .to_string()
  })?;

  let servers = root
    .entry("mcpServers".to_string())
    .or_insert_with(|| json!({}));
  let servers_obj = servers.as_object_mut().ok_or_else(|| {
    "Trường \"mcpServers\" trong tệp cấu hình không phải là một JSON object hợp lệ. Đã dừng lại để tránh ghi đè."
      .to_string()
  })?;

  servers_obj.insert(
    "affine".to_string(),
    json!({
      "command": exe_str,
      "args": ["--mcp"]
    }),
  );

  serde_json::to_string_pretty(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_mcp_status(window: tauri::WebviewWindow) -> Result<Vec<McpClientStatus>, String> {
  crate::ensure_trusted_window(&window)?;
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
pub fn install_mcp_config(
  window: tauri::WebviewWindow,
  client_id: String,
) -> Result<String, String> {
  crate::ensure_trusted_window(&window)?;
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
      let existing_content = if config_path.exists() {
        Some(fs::read_to_string(config_path).map_err(|e| e.to_string())?)
      } else {
        None
      };
      let new_content = merge_mcp_json_config(existing_content.as_deref(), &exe_str)?;
      if config_path.exists() {
        let backup_path = config_path.with_extension("bak");
        let _ = fs::copy(config_path, backup_path);
      }
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
      let existing = if config_path.exists() {
        fs::read_to_string(config_path).map_err(|e| e.to_string())?
      } else {
        String::new()
      };
      if !existing.contains("[mcp_servers.affine]") {
        if config_path.exists() {
          let backup_path = config_path.with_extension("bak");
          let _ = fs::copy(config_path, backup_path);
        }
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

  let existing_content = if config_path.exists() {
    Some(fs::read_to_string(config_path).map_err(|e| e.to_string())?)
  } else {
    None
  };
  let new_content = merge_mcp_json_config(existing_content.as_deref(), &exe_str)?;

  if config_path.exists() {
    let backup_path = config_path.with_extension("bak");
    let _ = fs::copy(config_path, backup_path);
  }
  fs::write(config_path, new_content).map_err(|e| e.to_string())?;

  Ok(client.name.to_string())
}

#[cfg(test)]
mod tests {
  use super::merge_mcp_json_config;

  #[test]
  fn merges_into_empty_or_missing_config() {
    let out = merge_mcp_json_config(None, "C:\\affine.exe").expect("should merge");
    let parsed: serde_json::Value = serde_json::from_str(&out).unwrap();
    assert_eq!(parsed["mcpServers"]["affine"]["command"], "C:\\affine.exe");
    assert_eq!(parsed["mcpServers"]["affine"]["args"], serde_json::json!(["--mcp"]));
  }

  #[test]
  fn preserves_existing_servers_and_keys() {
    let existing = r#"{ "theme": "dark", "mcpServers": { "other": { "command": "npx" } } }"#;
    let out = merge_mcp_json_config(Some(existing), "/usr/bin/affine").expect("should merge");
    let parsed: serde_json::Value = serde_json::from_str(&out).unwrap();
    assert_eq!(parsed["theme"], "dark");
    assert_eq!(parsed["mcpServers"]["other"]["command"], "npx");
    assert_eq!(parsed["mcpServers"]["affine"]["command"], "/usr/bin/affine");
  }

  #[test]
  fn refuses_to_overwrite_invalid_json() {
    let broken = "{ invalid json";
    let err = merge_mcp_json_config(Some(broken), "C:\\affine.exe").unwrap_err();
    assert!(err.contains("lỗi cú pháp"));
  }

  #[test]
  fn refuses_non_object_root_or_mcp_servers() {
    assert!(merge_mcp_json_config(Some("[]"), "C:\\affine.exe").is_err());
    assert!(
      merge_mcp_json_config(Some(r#"{ "mcpServers": [] }"#), "C:\\affine.exe").is_err()
    );
  }
}
