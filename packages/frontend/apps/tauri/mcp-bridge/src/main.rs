//! `affine-mcp` — runs the AFFiNE MCP bridge from a terminal, or as a stdio MCP
//! server for clients that start a command (Claude Desktop, Antigravity...).
//!
//! ```text
//! affine-mcp                    run the server (HTTP /mcp + app bridge)
//! affine-mcp --stdio            stdio transport; uses a running server if any
//! options: --port 20130  --host 127.0.0.1  --show-token
//! ```

use std::net::{IpAddr, Ipv4Addr};
use std::process::exit;

use affine_mcp_bridge::{Config, DEFAULT_PORT, Server, load_token, token_file_path};
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::mpsc;

struct Args {
  stdio: bool,
  show_token: bool,
  port: u16,
  host: IpAddr,
}

fn parse_args() -> Result<Args, String> {
  let mut args = Args {
    stdio: false,
    show_token: false,
    port: DEFAULT_PORT,
    host: IpAddr::V4(Ipv4Addr::LOCALHOST),
  };
  let mut iter = std::env::args().skip(1);
  while let Some(arg) = iter.next() {
    match arg.as_str() {
      "--stdio" => args.stdio = true,
      "--show-token" => args.show_token = true,
      "--port" => {
        args.port = iter
          .next()
          .and_then(|v| v.parse().ok())
          .ok_or("--port needs a number")?;
      }
      "--host" => {
        args.host = iter
          .next()
          .and_then(|v| v.parse().ok())
          .ok_or("--host needs an IP address")?;
      }
      other => return Err(format!("unknown option {other}")),
    }
  }
  Ok(args)
}

/// Minimal HTTP/1.1 request over TCP; returns (status, body).
async fn http_request(
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

async fn server_is_running(port: u16) -> bool {
  matches!(
    tokio::time::timeout(
      std::time::Duration::from_millis(1500),
      http_request(port, "GET", "/health", None, None)
    )
    .await,
    Ok(Ok((200, _)))
  )
}

async fn start_server(args: &Args, token: &str) -> Server {
  let mut config = Config::new(token.to_string());
  config.host = args.host;
  config.port = args.port;
  let server = Server::new(config);
  match server.listen().await {
    Ok(addr) => {
      eprintln!("[affine-mcp] MCP endpoint : http://{addr}/mcp");
      eprintln!("[affine-mcp] App bridge   : ws://{addr}/bridge");
      eprintln!("[affine-mcp] Token file   : {}", token_file_path().display());
      if args.show_token {
        eprintln!("[affine-mcp] Token        : {token}");
      } else {
        eprintln!("[affine-mcp] Add --show-token to print the token.");
      }
      server
    }
    Err(error) => {
      eprintln!("[affine-mcp] cannot listen on {}:{}: {error}", args.host, args.port);
      exit(1);
    }
  }
}

async fn run_server(args: Args, token: String) {
  let _server = start_server(&args, &token).await;
  let _ = tokio::signal::ctrl_c().await;
}

async fn run_stdio(args: Args, token: String) {
  // a running server (for example the one inside the app) is used as it is
  let local = if server_is_running(args.port).await {
    eprintln!("[affine-mcp] using the running server on port {}", args.port);
    None
  } else {
    Some(start_server(&args, &token).await)
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
    let port = args.port;
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

#[tokio::main]
async fn main() {
  let args = match parse_args() {
    Ok(args) => args,
    Err(message) => {
      eprintln!("[affine-mcp] {message}");
      exit(2);
    }
  };
  let token = match load_token() {
    Ok(token) => token,
    Err(error) => {
      eprintln!("[affine-mcp] cannot read or create the token: {error}");
      exit(1);
    }
  };
  if args.stdio {
    run_stdio(args, token).await;
  } else {
    run_server(args, token).await;
  }
}
