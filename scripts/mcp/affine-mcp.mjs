#!/usr/bin/env node
/**
 * AFFiNE MCP bridge.
 *
 *   node scripts/mcp/affine-mcp.mjs              run the server (HTTP + app bridge)
 *   node scripts/mcp/affine-mcp.mjs --stdio      stdio transport for MCP clients
 *   options: --port 20130  --host 127.0.0.1  --show-token
 *
 * HTTP clients: POST http://127.0.0.1:<port>/mcp with
 *   Authorization: Bearer <token>
 * stdio clients: use this script with --stdio as the command. If a server is
 * already running it is used; otherwise the stdio process starts its own.
 *
 * The token lives in ~/.affine-mcp/token (or AFFINE_MCP_TOKEN). Paste it into
 * AFFiNE: Settings -> MCP bridge.
 */
import readline from 'node:readline';

import {
  createMcpServer,
  DEFAULT_PORT,
  loadToken,
  tokenFilePath,
} from './core.mjs';

function parseArgs(argv) {
  const args = {
    stdio: false,
    showToken: false,
    port: DEFAULT_PORT,
    host: '127.0.0.1',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--stdio') args.stdio = true;
    else if (a === '--show-token') args.showToken = true;
    else if (a === '--port') args.port = Number(argv[++i]);
    else if (a === '--host') args.host = argv[++i];
  }
  if (!Number.isInteger(args.port) || args.port < 0 || args.port > 65535) {
    throw new Error('Invalid --port');
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const token = loadToken();
// stdout is reserved for JSON-RPC in stdio mode
const log = message => process.stderr.write(`[affine-mcp] ${message}\n`);

async function serverIsRunning() {
  try {
    const res = await fetch(`http://127.0.0.1:${args.port}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function runServer() {
  const server = createMcpServer({
    token,
    host: args.host,
    port: args.port,
    log,
  });
  const port = await server.start();
  log(`MCP endpoint : http://${args.host}:${port}/mcp`);
  log(`App bridge   : ws://${args.host}:${port}/bridge`);
  log(`Token file   : ${tokenFilePath()}`);
  if (args.showToken) log(`Token        : ${token}`);
  else log('Add --show-token to print the token.');
  const shutdown = () => server.stop().finally(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return server;
}

async function runStdio() {
  let handle;
  if (await serverIsRunning()) {
    log(`using the running server on port ${args.port}`);
    handle = async message => {
      const res = await fetch(`http://127.0.0.1:${args.port}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(message),
      });
      return res.status === 202 ? null : await res.json();
    };
  } else {
    const server = await runServer();
    handle = message => server.handleRpc(message);
  }

  const rl = readline.createInterface({ input: process.stdin });
  const writing = [];
  rl.on('line', line => {
    if (!line.trim()) return;
    const job = (async () => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' },
          }) + '\n'
        );
        return;
      }
      try {
        const response = await handle(message);
        if (response !== null)
          process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        log(
          `request failed: ${error instanceof Error ? error.message : error}`
        );
      }
    })();
    writing.push(job);
    void job.finally(() => writing.splice(writing.indexOf(job), 1));
  });
  rl.on('close', async () => {
    await Promise.all(writing);
    process.exit(0);
  });
}

if (args.stdio) await runStdio();
else await runServer();
