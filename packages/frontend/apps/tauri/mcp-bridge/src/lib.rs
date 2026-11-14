//! AFFiNE MCP bridge.
//!
//! ```text
//! AI agent --MCP (HTTP or stdio)--> this server --WebSocket--> AFFiNE app
//! ```
//!
//! The AFFiNE workspace lives inside the app (a webview), so the app connects
//! to this server and registers its tools; agents call those tools and the
//! server relays each call to the app. It speaks exactly the protocol of
//! `scripts/mcp` (the Node version), so either can be used.
//!
//! Security: loopback only, a bearer token for agents, the same token carried
//! in a WebSocket subprotocol for the app, and Host / Origin checks against
//! DNS rebinding and foreign web pages.

use std::collections::HashMap;
use std::io;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use axum::Router;
use axum::body::Bytes;
use axum::extract::State;
use axum::extract::ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{any, get};
use futures_util::{SinkExt, StreamExt};
use rand::RngCore;
use serde_json::{Value, json};
use subtle::ConstantTimeEq;
use tokio::sync::{Mutex, mpsc, oneshot};

pub const DEFAULT_PORT: u16 = 20130;
const SERVER_NAME: &str = "affine-mcp";
const SERVER_VERSION: &str = "0.1.0";
const SUPPORTED_PROTOCOLS: [&str; 3] = ["2025-06-18", "2025-03-26", "2024-11-05"];
const CALL_TIMEOUT: Duration = Duration::from_secs(60);
const KEEP_ALIVE: Duration = Duration::from_secs(25);
const MAX_BODY: usize = 4 * 1024 * 1024;
const NOT_CONNECTED: &str = "Ứng dụng AFFiNE chưa mở hoặc chưa bật cầu nối MCP (Cài đặt → Cầu nối MCP).";

#[derive(Clone, Debug)]
pub struct Config {
  pub host: IpAddr,
  pub port: u16,
  pub token: String,
  /// extra allowed Origins besides loopback pages and Tauri webviews
  pub origins: Vec<String>,
}

impl Config {
  pub fn new(token: String) -> Self {
    Self {
      host: IpAddr::V4(Ipv4Addr::LOCALHOST),
      port: DEFAULT_PORT,
      token,
      origins: Vec::new(),
    }
  }
}

/// `~/.affine-mcp/token`, the same file the Node bridge uses.
pub fn token_file_path() -> PathBuf {
  let home = std::env::var_os("USERPROFILE")
    .or_else(|| std::env::var_os("HOME"))
    .map(PathBuf::from)
    .unwrap_or_else(|| PathBuf::from("."));
  home.join(".affine-mcp").join("token")
}

/// Token from `AFFINE_MCP_TOKEN`, else the token file (created on first use).
pub fn load_token() -> io::Result<String> {
  if let Ok(token) = std::env::var("AFFINE_MCP_TOKEN") {
    if !token.is_empty() {
      return Ok(token);
    }
  }
  let path = token_file_path();
  if let Ok(existing) = std::fs::read_to_string(&path) {
    let existing = existing.trim().to_string();
    if existing.len() >= 32 {
      return Ok(existing);
    }
  }
  let mut bytes = [0u8; 32];
  rand::thread_rng().fill_bytes(&mut bytes);
  let token = hex::encode(bytes);
  if let Some(dir) = path.parent() {
    std::fs::create_dir_all(dir)?;
  }
  std::fs::write(&path, format!("{token}\n"))?;
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
  }
  Ok(token)
}

fn is_loopback_host(host: &str) -> bool {
  matches!(host, "localhost" | "127.0.0.1" | "[::1]" | "::1")
}

/// Splits `scheme://host[:port][/path]` into (scheme, host without port).
fn split_origin(origin: &str) -> Option<(&str, &str)> {
  let (scheme, rest) = origin.split_once("://")?;
  let authority = rest.split('/').next()?;
  let host = if authority.starts_with('[') {
    &authority[..authority.find(']')? + 1]
  } else {
    authority.split(':').next()?
  };
  Some((scheme, host))
}

/// Loopback pages, Tauri webviews and explicitly allowed origins.
pub fn is_allowed_origin(origin: Option<&str>, extra: &[String]) -> bool {
  let Some(origin) = origin else { return true };
  if extra.iter().any(|allowed| allowed == origin) {
    return true;
  }
  match split_origin(origin) {
    Some(("tauri", _)) => true,
    Some((_, "tauri.localhost")) => true,
    Some((_, host)) => is_loopback_host(host),
    None => false,
  }
}

fn is_allowed_host(host: Option<&str>) -> bool {
  let Some(host) = host else { return false };
  let name = if host.starts_with('[') {
    host.find(']').map(|end| &host[..=end]).unwrap_or(host)
  } else {
    host.split(':').next().unwrap_or(host)
  };
  is_loopback_host(name)
}

fn safe_equal(a: &str, b: &str) -> bool {
  a.as_bytes().ct_eq(b.as_bytes()).into()
}

struct Bridge {
  id: u64,
  tx: mpsc::UnboundedSender<Message>,
  workspace_id: String,
  workspace_name: String,
  tools: Vec<Value>,
}

type Pending = HashMap<String, (u64, oneshot::Sender<Result<Value, String>>)>;

struct Inner {
  config: Config,
  bridge: Mutex<Option<Bridge>>,
  pending: Mutex<Pending>,
  next_call: AtomicU64,
  next_bridge: AtomicU64,
}

/// A running (or embeddable) MCP bridge.
#[derive(Clone)]
pub struct Server {
  inner: Arc<Inner>,
}

fn rpc_ok(id: &Value, result: Value) -> Value {
  json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn rpc_error(id: &Value, code: i64, message: &str) -> Value {
  json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

fn text_result(text: &str, is_error: bool) -> Value {
  let mut value = json!({ "content": [{ "type": "text", "text": text }] });
  if is_error {
    value["isError"] = json!(true);
  }
  value
}

impl Server {
  pub fn new(config: Config) -> Self {
    Self {
      inner: Arc::new(Inner {
        config,
        bridge: Mutex::new(None),
        pending: Mutex::new(HashMap::new()),
        next_call: AtomicU64::new(1),
        next_bridge: AtomicU64::new(1),
      }),
    }
  }

  pub fn config(&self) -> &Config {
    &self.inner.config
  }

  /// Binds the HTTP / WebSocket listener and serves in the background.
  /// Returns the address actually bound (useful with port 0).
  pub async fn listen(&self) -> io::Result<SocketAddr> {
    let addr = SocketAddr::new(self.inner.config.host, self.inner.config.port);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    let bound = listener.local_addr()?;
    let router = Router::new()
      .route("/health", get(health))
      .route("/mcp", any(mcp))
      .route("/bridge", get(bridge_upgrade))
      .with_state(self.clone());
    tokio::spawn(async move {
      let _ = axum::serve(listener, router).await;
    });
    Ok(bound)
  }

  fn builtin_tools() -> Vec<Value> {
    vec![json!({
        "name": "affine_status",
        "description": "Cho biết ứng dụng AFFiNE có đang kết nối không, workspace nào đang mở và có những công cụ nào.",
        "inputSchema": { "type": "object", "properties": {} },
        "annotations": { "readOnlyHint": true },
    })]
  }

  async fn list_tools(&self) -> Vec<Value> {
    let mut tools = Self::builtin_tools();
    if let Some(bridge) = self.inner.bridge.lock().await.as_ref() {
      for tool in &bridge.tools {
        tools.push(json!({
            "name": tool["name"],
            "description": tool["description"],
            "inputSchema": tool.get("inputSchema").cloned()
                .unwrap_or_else(|| json!({ "type": "object", "properties": {} })),
            "annotations": { "readOnlyHint": !tool["write"].as_bool().unwrap_or(false) },
        }));
      }
    }
    tools
  }

  async fn call_tool(&self, params: &Value) -> Value {
    let name = params["name"].as_str().unwrap_or_default().to_string();
    let args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));

    let (call_id, bridge_id, rx) = {
      let bridge = self.inner.bridge.lock().await;
      if name == "affine_status" {
        let status = json!({
            "connected": bridge.is_some(),
            "workspace": bridge.as_ref().map(|b| b.workspace_name.clone()),
            "workspaceId": bridge.as_ref().map(|b| b.workspace_id.clone()),
            "tools": bridge.as_ref().map(|b| b.tools.iter()
                .filter_map(|t| t["name"].as_str().map(String::from))
                .collect::<Vec<_>>()).unwrap_or_default(),
        });
        return text_result(&serde_json::to_string_pretty(&status).unwrap_or_default(), false);
      }
      let Some(bridge) = bridge.as_ref() else {
        return text_result(NOT_CONNECTED, true);
      };
      if !bridge.tools.iter().any(|t| t["name"] == name) {
        return text_result(&format!("Không có công cụ \"{name}\"."), true);
      }
      let call_id = self.inner.next_call.fetch_add(1, Ordering::Relaxed).to_string();
      let (tx, rx) = oneshot::channel();
      self.inner.pending.lock().await.insert(call_id.clone(), (bridge.id, tx));
      let message = json!({ "type": "call", "id": call_id, "tool": name, "args": args });
      if bridge.tx.send(Message::Text(message.to_string().into())).is_err() {
        self.inner.pending.lock().await.remove(&call_id);
        return text_result(NOT_CONNECTED, true);
      }
      (call_id, bridge.id, rx)
    };
    let _ = bridge_id;

    let outcome = tokio::time::timeout(CALL_TIMEOUT, rx).await;
    match outcome {
      Ok(Ok(Ok(result))) => {
        let text = match result {
          Value::String(text) => text,
          other => serde_json::to_string_pretty(&other).unwrap_or_default(),
        };
        text_result(&text, false)
      }
      Ok(Ok(Err(message))) => text_result(&message, true),
      Ok(Err(_)) => text_result("Ứng dụng AFFiNE đã ngắt kết nối", true),
      Err(_) => {
        self.inner.pending.lock().await.remove(&call_id);
        text_result(&format!("Hết thời gian chờ công cụ \"{name}\""), true)
      }
    }
  }

  /// Handles one JSON-RPC message; `None` means "no response" (a notification).
  pub fn handle_rpc<'a>(
    &'a self,
    message: Value,
  ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Option<Value>> + Send + 'a>> {
    Box::pin(async move {
      if let Value::Array(items) = message {
        let mut out = Vec::new();
        for item in items {
          if let Some(response) = self.handle_rpc(item).await {
            out.push(response);
          }
        }
        return if out.is_empty() { None } else { Some(Value::Array(out)) };
      }
      let Some(method) = message["method"].as_str() else {
        return Some(rpc_error(
          message.get("id").unwrap_or(&Value::Null),
          -32600,
          "Invalid Request",
        ));
      };
      if message["jsonrpc"] != "2.0" {
        return Some(rpc_error(
          message.get("id").unwrap_or(&Value::Null),
          -32600,
          "Invalid Request",
        ));
      }
      let is_notification = message.get("id").is_none();
      let id = message.get("id").cloned().unwrap_or(Value::Null);
      let params = message.get("params").cloned().unwrap_or(Value::Null);

      match method {
        "initialize" => {
          let requested = params["protocolVersion"].as_str().unwrap_or_default();
          let version = if SUPPORTED_PROTOCOLS.contains(&requested) {
            requested
          } else {
            SUPPORTED_PROTOCOLS[0]
          };
          Some(rpc_ok(
            &id,
            json!({
                "protocolVersion": version,
                "capabilities": { "tools": { "listChanged": false } },
                "serverInfo": { "name": SERVER_NAME, "version": SERVER_VERSION },
                "instructions": "Công cụ thao tác trực tiếp trên workspace AFFiNE đang mở. Gọi affine_status trước để xem trạng thái.",
            }),
          ))
        }
        "ping" => Some(rpc_ok(&id, json!({}))),
        "tools/list" => Some(rpc_ok(&id, json!({ "tools": self.list_tools().await }))),
        "tools/call" => Some(rpc_ok(&id, self.call_tool(&params).await)),
        _ if is_notification => None,
        _ => Some(rpc_error(&id, -32601, "Method not found")),
      }
    })
  }

  async fn reject_pending(&self, bridge_id: u64, reason: &str) {
    let mut pending = self.inner.pending.lock().await;
    let ids: Vec<String> = pending
      .iter()
      .filter(|(_, (owner, _))| *owner == bridge_id)
      .map(|(id, _)| id.clone())
      .collect();
    for id in ids {
      if let Some((_, tx)) = pending.remove(&id) {
        let _ = tx.send(Err(reason.to_string()));
      }
    }
  }

  async fn run_bridge(&self, socket: WebSocket) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let id = self.inner.next_bridge.fetch_add(1, Ordering::Relaxed);

    // a new connection replaces the old one
    {
      let mut slot = self.inner.bridge.lock().await;
      if let Some(old) = slot.take() {
        let _ = old.tx.send(Message::Close(Some(CloseFrame {
          code: 4000,
          reason: "replaced".into(),
        })));
        drop(old);
        self.reject_pending_locked_free(id).await;
      }
      *slot = Some(Bridge {
        id,
        tx,
        workspace_id: String::new(),
        workspace_name: String::new(),
        tools: Vec::new(),
      });
    }

    let writer = tokio::spawn(async move {
      let mut ticker = tokio::time::interval(KEEP_ALIVE);
      ticker.tick().await;
      loop {
        tokio::select! {
            message = rx.recv() => match message {
                Some(message) => {
                    let closing = matches!(message, Message::Close(_));
                    if sink.send(message).await.is_err() || closing { break; }
                }
                None => break,
            },
            _ = ticker.tick() => {
                if sink.send(Message::Ping(Vec::new().into())).await.is_err() { break; }
            }
        }
      }
    });

    while let Some(Ok(message)) = stream.next().await {
      let Message::Text(text) = message else {
        if matches!(message, Message::Close(_)) {
          break;
        }
        continue;
      };
      let Ok(value) = serde_json::from_str::<Value>(text.as_str()) else {
        continue;
      };
      match value["type"].as_str() {
        Some("hello") => {
          let mut slot = self.inner.bridge.lock().await;
          if let Some(bridge) = slot.as_mut().filter(|b| b.id == id) {
            bridge.workspace_id = value["workspaceId"].as_str().unwrap_or_default().into();
            bridge.workspace_name = value["workspaceName"].as_str().unwrap_or_default().into();
          }
        }
        Some("tools") => {
          let tools: Vec<Value> = value["tools"]
            .as_array()
            .map(|list| {
              list
                .iter()
                .filter(|t| t["name"].is_string())
                .map(|t| {
                  json!({
                      "name": t["name"],
                      "description": t["description"].as_str().unwrap_or_default(),
                      "inputSchema": t.get("inputSchema").cloned().unwrap_or(Value::Null),
                      "write": t["write"].as_bool().unwrap_or(false),
                  })
                })
                .collect()
            })
            .unwrap_or_default();
          let mut slot = self.inner.bridge.lock().await;
          if let Some(bridge) = slot.as_mut().filter(|b| b.id == id) {
            bridge.tools = tools;
          }
        }
        Some("result") => {
          let call_id = value["id"]
            .as_str()
            .map(String::from)
            .or_else(|| value["id"].as_u64().map(|n| n.to_string()));
          if let Some(call_id) = call_id {
            if let Some((_, tx)) = self.inner.pending.lock().await.remove(&call_id) {
              let outcome = if value["ok"].as_bool().unwrap_or(false) {
                Ok(value["result"].clone())
              } else {
                Err(value["error"].as_str().unwrap_or("Lỗi không rõ").to_string())
              };
              let _ = tx.send(outcome);
            }
          }
        }
        _ => {}
      }
    }

    writer.abort();
    let mut slot = self.inner.bridge.lock().await;
    if slot.as_ref().is_some_and(|b| b.id == id) {
      *slot = None;
      drop(slot);
      self.reject_pending(id, "Ứng dụng AFFiNE đã ngắt kết nối").await;
    }
  }

  /// Rejects every call that belonged to a bridge older than `new_id`.
  async fn reject_pending_locked_free(&self, new_id: u64) {
    let mut pending = self.inner.pending.lock().await;
    let stale: Vec<String> = pending
      .iter()
      .filter(|(_, (owner, _))| *owner < new_id)
      .map(|(id, _)| id.clone())
      .collect();
    for id in stale {
      if let Some((_, tx)) = pending.remove(&id) {
        let _ = tx.send(Err("Kết nối cầu nối bị thay thế".to_string()));
      }
    }
  }
}

fn json_response(status: StatusCode, body: &Value) -> Response {
  (
    status,
    [
      (header::CONTENT_TYPE, "application/json"),
      (header::CACHE_CONTROL, "no-store"),
    ],
    body.to_string(),
  )
    .into_response()
}

fn host_header(headers: &HeaderMap) -> Option<&str> {
  headers.get(header::HOST).and_then(|v| v.to_str().ok())
}

fn origin_header(headers: &HeaderMap) -> Option<&str> {
  headers.get(header::ORIGIN).and_then(|v| v.to_str().ok())
}

async fn health(State(server): State<Server>, headers: HeaderMap) -> Response {
  if !is_allowed_host(host_header(&headers)) {
    return json_response(StatusCode::FORBIDDEN, &json!({ "error": "Host not allowed" }));
  }
  let bridge = server.inner.bridge.lock().await;
  json_response(
    StatusCode::OK,
    &json!({
        "ok": true,
        "bridge": bridge.is_some(),
        "workspace": bridge.as_ref().map(|b| b.workspace_name.clone()),
    }),
  )
}

async fn mcp(State(server): State<Server>, method: axum::http::Method, headers: HeaderMap, body: Bytes) -> Response {
  if !is_allowed_host(host_header(&headers)) {
    return json_response(StatusCode::FORBIDDEN, &json!({ "error": "Host not allowed" }));
  }
  if !is_allowed_origin(origin_header(&headers), &server.inner.config.origins) {
    return json_response(StatusCode::FORBIDDEN, &json!({ "error": "Origin not allowed" }));
  }
  let bearer = headers
    .get(header::AUTHORIZATION)
    .and_then(|v| v.to_str().ok())
    .and_then(|v| v.strip_prefix("Bearer "));
  if !bearer.is_some_and(|token| safe_equal(token, &server.inner.config.token)) {
    let mut response = json_response(StatusCode::UNAUTHORIZED, &json!({ "error": "Unauthorized" }));
    response
      .headers_mut()
      .insert(header::WWW_AUTHENTICATE, "Bearer".parse().unwrap());
    return response;
  }

  match method {
    axum::http::Method::POST => {
      if body.len() > MAX_BODY {
        return json_response(StatusCode::PAYLOAD_TOO_LARGE, &json!({ "error": "Body too large" }));
      }
      let Ok(message) = serde_json::from_slice::<Value>(&body) else {
        return json_response(StatusCode::BAD_REQUEST, &rpc_error(&Value::Null, -32700, "Parse error"));
      };
      match server.handle_rpc(message).await {
        Some(response) => json_response(StatusCode::OK, &response),
        None => StatusCode::ACCEPTED.into_response(),
      }
    }
    axum::http::Method::DELETE => StatusCode::OK.into_response(),
    _ => (StatusCode::METHOD_NOT_ALLOWED, [(header::ALLOW, "POST, DELETE")]).into_response(),
  }
}

async fn bridge_upgrade(State(server): State<Server>, headers: HeaderMap, ws: WebSocketUpgrade) -> Response {
  if !is_allowed_host(host_header(&headers)) {
    return StatusCode::FORBIDDEN.into_response();
  }
  if !is_allowed_origin(origin_header(&headers), &server.inner.config.origins) {
    return StatusCode::FORBIDDEN.into_response();
  }
  let protocols: Vec<&str> = headers
    .get(header::SEC_WEBSOCKET_PROTOCOL)
    .and_then(|v| v.to_str().ok())
    .map(|v| v.split(',').map(str::trim).collect())
    .unwrap_or_default();
  let token = protocols.iter().find_map(|p| p.strip_prefix("token."));
  if !protocols.contains(&"affine-mcp") || !token.is_some_and(|t| safe_equal(t, &server.inner.config.token)) {
    return StatusCode::UNAUTHORIZED.into_response();
  }
  ws.protocols(["affine-mcp"])
    .on_upgrade(move |socket| async move { server.run_bridge(socket).await })
}

use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

/// Minimal HTTP/1.1 request over TCP; returns (status, body).
pub async fn http_request(
  port: u16,
  method: &str,
  path: &str,
  token: Option<&str>,
  body: Option<&str>,
) -> std::io::Result<(u16, String)> {
  let mut stream = TcpStream::connect(("127.0.0.1", port)).await?;
  let body = body.unwrap_or("");
  let mut request = format!("{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n");
  if let Some(token) = token {
    request.push_str(&format!("Authorization: Bearer {token}\r\n"));
  }
  request.push_str(&format!(
    "Content-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
    body.len()
  ));
  stream.write_all(request.as_bytes()).await?;
  let mut raw = Vec::new();
  stream.read_to_end(&mut raw).await?;
  let text = String::from_utf8_lossy(&raw).to_string();
  let (head, payload) = text.split_once("\r\n\r\n").unwrap_or((&text, ""));
  let status = head.split_whitespace().nth(1).and_then(|s| s.parse().ok()).unwrap_or(0);
  Ok((status, payload.to_string()))
}

pub async fn server_is_running(port: u16) -> bool {
  matches!(
    tokio::time::timeout(
      std::time::Duration::from_millis(1500),
      http_request(port, "GET", "/health", None, None)
    )
    .await,
    Ok(Ok((200, _)))
  )
}

pub async fn run_stdio(port: u16, token: String) {
  let local = if server_is_running(port).await {
    eprintln!("[affine-mcp] using the running server on port {port}");
    None
  } else {
    let mut config = Config::new(token.clone());
    config.port = port;
    let server = Server::new(config);
    match server.listen().await {
      Ok(addr) => {
        eprintln!("[affine-mcp] MCP endpoint : http://{addr}/mcp");
        eprintln!("[affine-mcp] App bridge   : ws://{addr}/bridge");
      }
      Err(error) => {
        eprintln!("[affine-mcp] cannot listen on port {port}: {error}");
      }
    }
    Some(server)
  };

  let (out_tx, mut out_rx) = mpsc::unbounded_channel::<String>();
  let writer = tokio::spawn(async move {
    let mut stdout = tokio::io::stdout();
    while let Some(line) = out_rx.recv().await {
      if stdout.write_all(line.as_bytes()).await.is_err()
        || stdout.write_all(b"\n").await.is_err()
        || stdout.flush().await.is_err()
      {
        break;
      }
    }
  });

  let mut lines = BufReader::new(tokio::io::stdin()).lines();
  let mut jobs = Vec::new();
  while let Ok(Some(line)) = lines.next_line().await {
    if line.trim().is_empty() {
      continue;
    }
    let out_tx = out_tx.clone();
    let local = local.clone();
    let token = token.clone();
    jobs.push(tokio::spawn(async move {
      let message: Value = match serde_json::from_str(&line) {
        Ok(message) => message,
        Err(_) => {
          let _ = out_tx.send(
            json!({ "jsonrpc": "2.0", "id": null,
                    "error": { "code": -32700, "message": "Parse error" } })
            .to_string(),
          );
          return;
        }
      };
      let response = match local {
        Some(server) => server.handle_rpc(message).await,
        None => match http_request(port, "POST", "/mcp", Some(&token), Some(&line)).await {
          Ok((202, _)) => None,
          Ok((_, body)) => serde_json::from_str::<Value>(&body).ok(),
          Err(error) => {
            eprintln!("[affine-mcp] request failed: {error}");
            None
          }
        },
      };
      if let Some(response) = response {
        let _ = out_tx.send(response.to_string());
      }
    }));
  }
  for job in jobs {
    let _ = job.await;
  }
  drop(out_tx);
  let _ = writer.await;
}
