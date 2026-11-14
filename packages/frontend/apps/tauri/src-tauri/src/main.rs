// Keeps the console window away in release builds on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod mcp_install;

use affine_mcp_bridge::{Config, DEFAULT_PORT, Server, load_token, run_stdio};
use serde::Serialize;

/// What the web app needs to connect to the MCP bridge that runs in this app.
#[derive(Clone, Serialize)]
struct McpInfo {
  url: String,
  token: String,
}

struct McpState {
  info: Option<McpInfo>,
}

/// Lets the web app configure its MCP panel without the person copying a token.
#[tauri::command]
fn mcp_info(state: tauri::State<'_, McpState>) -> Option<McpInfo> {
  state.info.clone()
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
      mcp_info,
      mcp_install::get_mcp_status,
      mcp_install::install_mcp_config,
    ])
    .setup(move |_app| {
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
