use std::net::{IpAddr, Ipv4Addr};
use std::process::exit;

use affine_mcp_bridge::{Config, DEFAULT_PORT, Server, load_token, run_stdio, token_file_path};

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
    run_stdio(args.port, token).await;
  } else {
    run_server(args, token).await;
  }
}
