// Keeps the console window away in release builds on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod mcp_install;

use affine_mcp_bridge::{Config, DEFAULT_PORT, Server, load_token, run_stdio};
use serde::Serialize;
use tauri::Manager;

/// What the web app needs to connect to the MCP bridge that runs in this app.
#[derive(Clone, Serialize)]
struct McpInfo {
  url: String,
  token: String,
}

struct McpState {
  info: Option<McpInfo>,
}

/// Ensures sensitive Tauri commands can only be invoked by the local main window.
pub(crate) fn ensure_trusted_window(window: &tauri::WebviewWindow) -> Result<(), String> {
  if window.label() != "main" {
    return Err("Lệnh này chỉ được phép gọi từ cửa sổ chính của ứng dụng.".to_string());
  }
  let url = window
    .url()
    .map_err(|e| format!("Không xác minh được nguồn cửa sổ: {e}"))?;
  let scheme = url.scheme();
  let host = url.host_str().unwrap_or("");
  let is_local_origin = scheme == "tauri"
    || host == "tauri.localhost"
    || host == "localhost"
    || host == "127.0.0.1";
  if !is_local_origin {
    return Err(format!(
      "Từ chối thực thi lệnh từ nguồn không tin cậy: {scheme}://{host}"
    ));
  }
  Ok(())
}

/// Single source of truth for the personal desktop version (from Cargo.toml).
#[tauri::command]
fn app_version() -> &'static str {
  env!("CARGO_PKG_VERSION")
}

/// Lets the web app configure its MCP panel without the person copying a token.
#[tauri::command]
fn mcp_info(
  window: tauri::WebviewWindow,
  state: tauri::State<'_, McpState>,
) -> Result<Option<McpInfo>, String> {
  ensure_trusted_window(&window)?;
  Ok(state.info.clone())
}

fn main() {
  let args: Vec<String> = std::env::args().collect();
  if args.iter().any(|a| a == "--mcp" || a == "--stdio") {
    let token = load_token().unwrap_or_else(|_| "anonymous".to_string());
    tauri::async_runtime::block_on(async move {
      run_stdio(DEFAULT_PORT, token).await;
    });
    return;
  }

  let token = load_token().ok();
  let info = token.as_ref().map(|token| McpInfo {
    url: format!("ws://127.0.0.1:{DEFAULT_PORT}/bridge"),
    token: token.clone(),
  });

  tauri::Builder::default()
    .manage(McpState { info })
    .invoke_handler(tauri::generate_handler![
      app_version,
      mcp_info,
      mcp_install::get_mcp_status,
      mcp_install::install_mcp_config,
    ])
    .setup(move |app| {
      if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_title(&format!("AFFiNE v{}", env!("CARGO_PKG_VERSION")));
      }
      if let Some(token) = token {
        // The MCP bridge lives and dies with the app. If another copy
        // (or `affine-mcp`) already holds the port, that one is used.
        let server = Server::new(Config::new(token));
        tauri::async_runtime::spawn(async move {
          match server.listen().await {
            Ok(addr) => println!("MCP bridge listening on {addr}"),
            Err(error) => eprintln!("MCP bridge not started: {error}"),
          }
          // keep the server alive for the lifetime of the runtime
          std::future::pending::<()>().await;
        });
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running the AFFiNE app");
}
