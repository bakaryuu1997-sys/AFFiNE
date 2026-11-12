//! Integration tests: a real server on a random port, a raw TCP HTTP client for
//! the agent side and a WebSocket client standing in for the AFFiNE app.

use std::net::SocketAddr;

use affine_mcp_bridge::{Config, Server, is_allowed_origin};
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;

const TOKEN: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

async fn start() -> (Server, SocketAddr) {
  let mut config = Config::new(TOKEN.to_string());
  config.port = 0;
  let server = Server::new(config);
  let addr = server.listen().await.expect("listen");
  (server, addr)
}

/// Sends one HTTP request and returns (status, body).
async fn http(addr: SocketAddr, method: &str, path: &str, headers: &[(&str, &str)], body: &str) -> (u16, String) {
  let mut stream = TcpStream::connect(addr).await.unwrap();
  let mut request = format!("{method} {path} HTTP/1.1\r\nConnection: close\r\n");
  if !headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("host")) {
    request.push_str(&format!("Host: 127.0.0.1:{}\r\n", addr.port()));
  }
  for (key, value) in headers {
    request.push_str(&format!("{key}: {value}\r\n"));
  }
  request.push_str(&format!("Content-Length: {}\r\n\r\n{body}", body.len()));
  stream.write_all(request.as_bytes()).await.unwrap();
  let mut raw = Vec::new();
  stream.read_to_end(&mut raw).await.unwrap();
  let text = String::from_utf8_lossy(&raw).to_string();
  let (head, payload) = text.split_once("\r\n\r\n").unwrap_or((&text, ""));
  let status = head.split_whitespace().nth(1).unwrap().parse().unwrap();
  // axum answers with content-length, so the payload is the body as it is
  (status, payload.to_string())
}

async fn rpc(addr: SocketAddr, method: &str, params: Value) -> Value {
  let auth = format!("Bearer {TOKEN}");
  let body = json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params });
  let (status, text) = http(
    addr,
    "POST",
    "/mcp",
    &[("Authorization", &auth), ("Content-Type", "application/json")],
    &body.to_string(),
  )
  .await;
  assert_eq!(status, 200, "{text}");
  serde_json::from_str(&text).unwrap()
}

type App = tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<TcpStream>>;

async fn connect_app(
  addr: SocketAddr,
  protocols: &str,
  origin: Option<&str>,
) -> Result<App, tokio_tungstenite::tungstenite::Error> {
  let mut request = format!("ws://{addr}/bridge").into_client_request().unwrap();
  request
    .headers_mut()
    .insert("Sec-WebSocket-Protocol", HeaderValue::from_str(protocols).unwrap());
  if let Some(origin) = origin {
    request
      .headers_mut()
      .insert("Origin", HeaderValue::from_str(origin).unwrap());
  }
  tokio_tungstenite::connect_async(request).await.map(|(ws, _)| ws)
}

fn good_protocols() -> String {
  format!("affine-mcp, token.{TOKEN}")
}

async fn wait_for_tools(addr: SocketAddr, count: usize) {
  for _ in 0..200 {
    let list = rpc(addr, "tools/list", json!({})).await;
    if list["result"]["tools"].as_array().map(Vec::len) == Some(count) {
      return;
    }
    tokio::time::sleep(std::time::Duration::from_millis(15)).await;
  }
  panic!("tool list never reached {count}");
}

#[tokio::test]
async fn health_needs_no_token() {
  let (_server, addr) = start().await;
  let (status, body) = http(addr, "GET", "/health", &[], "").await;
  assert_eq!(status, 200);
  let value: Value = serde_json::from_str(&body).unwrap();
  assert_eq!(value["ok"], true);
  assert_eq!(value["bridge"], false);
}

#[tokio::test]
async fn rejects_missing_wrong_token_origin_and_host() {
  let (_server, addr) = start().await;
  let body = r#"{"jsonrpc":"2.0","id":1,"method":"ping"}"#;
  assert_eq!(http(addr, "POST", "/mcp", &[], body).await.0, 401);
  assert_eq!(
    http(addr, "POST", "/mcp", &[("Authorization", "Bearer nope")], body)
      .await
      .0,
    401
  );
  let auth = format!("Bearer {TOKEN}");
  assert_eq!(
    http(
      addr,
      "POST",
      "/mcp",
      &[("Authorization", &auth), ("Origin", "https://evil.example")],
      body
    )
    .await
    .0,
    403
  );
  assert_eq!(
    http(addr, "GET", "/health", &[("Host", "evil.example")], "").await.0,
    403
  );
}

#[tokio::test]
async fn protocol_basics() {
  let (_server, addr) = start().await;
  let init = rpc(addr, "initialize", json!({ "protocolVersion": "2025-03-26" })).await;
  assert_eq!(init["result"]["protocolVersion"], "2025-03-26");
  assert_eq!(init["result"]["serverInfo"]["name"], "affine-mcp");

  let tools = rpc(addr, "tools/list", json!({})).await;
  assert_eq!(tools["result"]["tools"][0]["name"], "affine_status");

  let status = rpc(addr, "tools/call", json!({ "name": "affine_status" })).await;
  let text = status["result"]["content"][0]["text"].as_str().unwrap();
  assert_eq!(serde_json::from_str::<Value>(text).unwrap()["connected"], false);

  let missing = rpc(addr, "tools/call", json!({ "name": "read_doc" })).await;
  assert_eq!(missing["result"]["isError"], true);

  let unknown = rpc(addr, "nope", json!({})).await;
  assert_eq!(unknown["error"]["code"], -32601);

  // notifications get 202 and no body
  let auth = format!("Bearer {TOKEN}");
  let (status, _) = http(
    addr,
    "POST",
    "/mcp",
    &[("Authorization", &auth)],
    r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#,
  )
  .await;
  assert_eq!(status, 202);
}

#[tokio::test]
async fn app_must_present_the_token_and_an_allowed_origin() {
  let (_server, addr) = start().await;
  assert!(connect_app(addr, "affine-mcp, token.wrong", None).await.is_err());
  assert!(connect_app(addr, "affine-mcp", None).await.is_err());
  assert!(
    connect_app(addr, &good_protocols(), Some("https://evil.example"))
      .await
      .is_err()
  );
  assert!(
    connect_app(addr, &good_protocols(), Some("http://localhost:8080"))
      .await
      .is_ok()
  );
}

#[tokio::test]
async fn relays_calls_including_large_results_and_errors() {
  let (_server, addr) = start().await;
  let mut app = connect_app(addr, &good_protocols(), None).await.unwrap();
  app
    .send(Message::text(
      json!({ "type": "hello", "workspaceId": "w1", "workspaceName": "Demo" }).to_string(),
    ))
    .await
    .unwrap();
  app
    .send(Message::text(
      json!({ "type": "tools", "tools": [
          { "name": "echo", "description": "echo", "write": true },
          { "name": "big", "description": "big" },
          { "name": "fail", "description": "fail" },
      ]})
      .to_string(),
    ))
    .await
    .unwrap();

  // the fake app answers calls in the background
  let big = "x".repeat(200_000);
  let answerer = tokio::spawn(async move {
    while let Some(Ok(Message::Text(text))) = app.next().await {
      let message: Value = serde_json::from_str(text.as_str()).unwrap();
      if message["type"] != "call" {
        continue;
      }
      let reply = match message["tool"].as_str().unwrap() {
        "echo" => json!({ "type": "result", "id": message["id"], "ok": true,
                                  "result": { "got": message["args"] } }),
        "big" => json!({ "type": "result", "id": message["id"], "ok": true, "result": big }),
        _ => json!({ "type": "result", "id": message["id"], "ok": false, "error": "boom" }),
      };
      app.send(Message::text(reply.to_string())).await.unwrap();
    }
  });

  wait_for_tools(addr, 4).await;
  let list = rpc(addr, "tools/list", json!({})).await;
  let tools = list["result"]["tools"].as_array().unwrap();
  let find = |name: &str| tools.iter().find(|t| t["name"] == name).unwrap().clone();
  assert_eq!(find("echo")["annotations"]["readOnlyHint"], false);
  assert_eq!(find("big")["annotations"]["readOnlyHint"], true);

  let echo = rpc(addr, "tools/call", json!({ "name": "echo", "arguments": { "a": 1 } })).await;
  let text = echo["result"]["content"][0]["text"].as_str().unwrap();
  assert_eq!(
    serde_json::from_str::<Value>(text).unwrap(),
    json!({ "got": { "a": 1 } })
  );

  let large = rpc(addr, "tools/call", json!({ "name": "big", "arguments": {} })).await;
  assert_eq!(large["result"]["content"][0]["text"].as_str().unwrap().len(), 200_000);

  let failed = rpc(addr, "tools/call", json!({ "name": "fail", "arguments": {} })).await;
  assert_eq!(failed["result"]["isError"], true);
  assert!(
    failed["result"]["content"][0]["text"]
      .as_str()
      .unwrap()
      .contains("boom")
  );

  let status = rpc(addr, "tools/call", json!({ "name": "affine_status" })).await;
  let text = status["result"]["content"][0]["text"].as_str().unwrap();
  assert_eq!(serde_json::from_str::<Value>(text).unwrap()["workspace"], "Demo");

  answerer.abort();
}

#[tokio::test]
async fn a_call_pending_when_the_app_disconnects_fails_cleanly() {
  let (_server, addr) = start().await;
  let mut app = connect_app(addr, &good_protocols(), None).await.unwrap();
  app
    .send(Message::text(
      json!({ "type": "tools", "tools": [{ "name": "slow", "description": "s" }] }).to_string(),
    ))
    .await
    .unwrap();
  wait_for_tools(addr, 2).await;

  // close as soon as the call arrives
  tokio::spawn(async move {
    while let Some(Ok(message)) = app.next().await {
      if matches!(message, Message::Text(_)) {
        let _ = app.close(None).await;
        break;
      }
    }
  });
  let result = rpc(addr, "tools/call", json!({ "name": "slow", "arguments": {} })).await;
  assert_eq!(result["result"]["isError"], true);
  assert!(
    result["result"]["content"][0]["text"]
      .as_str()
      .unwrap()
      .contains("ngắt kết nối")
  );
  wait_for_tools(addr, 1).await;
}

#[test]
fn origin_rules() {
  assert!(is_allowed_origin(None, &[]));
  assert!(is_allowed_origin(Some("http://localhost:8080"), &[]));
  assert!(is_allowed_origin(Some("http://127.0.0.1:3000"), &[]));
  assert!(is_allowed_origin(Some("http://[::1]:3000"), &[]));
  assert!(is_allowed_origin(Some("tauri://localhost"), &[]));
  assert!(is_allowed_origin(Some("http://tauri.localhost"), &[]));
  assert!(is_allowed_origin(
    Some("https://notes.example"),
    &["https://notes.example".to_string()]
  ));
  assert!(!is_allowed_origin(Some("https://evil.example"), &[]));
  assert!(!is_allowed_origin(Some("https://localhost.evil.example"), &[]));
  assert!(!is_allowed_origin(Some("not a url"), &[]));
}
