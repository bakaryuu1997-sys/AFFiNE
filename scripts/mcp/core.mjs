/**
 * AFFiNE MCP bridge core.
 *
 *   AI agent  --MCP (HTTP or stdio)-->  this server  --WebSocket-->  AFFiNE app
 *
 * The AFFiNE workspace lives inside the app (browser / webview), so the app
 * connects to this server and registers its tools; agents call those tools and
 * this server relays each call to the app.
 *
 * Security: loopback only, a bearer token for agents and a token carried in a
 * WebSocket subprotocol for the app, Host and Origin checks against DNS
 * rebinding and foreign web pages.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { acceptWebSocket } from './ws-server.mjs';

export const SERVER_INFO = { name: 'affine-mcp', version: '0.1.0' };
export const DEFAULT_PORT = 20130;
const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const CALL_TIMEOUT_MS = 60_000;
const MAX_BODY = 4 * 1024 * 1024;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function tokenFilePath() {
  return path.join(os.homedir(), '.affine-mcp', 'token');
}

/** Token from AFFINE_MCP_TOKEN, else the token file (created on first use). */
export function loadToken() {
  if (process.env.AFFINE_MCP_TOKEN) return process.env.AFFINE_MCP_TOKEN;
  const file = tokenFilePath();
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    // create below
  }
  const token = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, token + '\n', { mode: 0o600 });
  return token;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Loopback pages, Tauri webviews and explicitly allowed origins. */
export function isAllowedOrigin(origin, extra = []) {
  if (!origin) return true;
  if (extra.includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.protocol === 'tauri:') return true;
    if (url.hostname === 'tauri.localhost') return true;
    return LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function isAllowedHost(hostHeader) {
  if (!hostHeader) return false;
  const host = hostHeader.startsWith('[')
    ? hostHeader.slice(0, hostHeader.indexOf(']') + 1)
    : hostHeader.split(':')[0];
  return LOOPBACK_HOSTS.has(host);
}

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
});

const textResult = (text, isError = false) => ({
  content: [{ type: 'text', text }],
  ...(isError ? { isError: true } : {}),
});

export function createMcpServer({
  token,
  host = '127.0.0.1',
  port = DEFAULT_PORT,
  origins = [],
  log = () => {},
} = {}) {
  if (!token) throw new Error('A token is required');

  /** @type {{conn: any, hello: any, tools: any[]} | null} */
  let bridge = null;
  const pending = new Map();
  let nextCallId = 1;

  function rejectAllPending(message) {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error(message));
    }
    pending.clear();
  }

  function callApp(tool, args) {
    const active = bridge;
    if (!active) {
      throw new Error(
        'Ứng dụng AFFiNE chưa mở hoặc chưa bật cầu nối MCP (Cài đặt → Cầu nối MCP).'
      );
    }
    const id = String(nextCallId++);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Hết thời gian chờ công cụ "${tool}"`));
      }, CALL_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      active.conn.send(JSON.stringify({ type: 'call', id, tool, args }));
    });
  }

  function builtinTools() {
    return [
      {
        name: 'affine_status',
        description:
          'Cho biết ứng dụng AFFiNE có đang kết nối không, workspace nào đang mở và có những công cụ nào.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { readOnlyHint: true },
      },
    ];
  }

  function listTools() {
    const appTools = (bridge?.tools ?? []).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
      annotations: { readOnlyHint: !tool.write },
    }));
    return [...builtinTools(), ...appTools];
  }

  async function callTool(params) {
    const name = params?.name;
    const args = params?.arguments ?? {};
    if (name === 'affine_status') {
      return textResult(
        JSON.stringify(
          {
            connected: Boolean(bridge),
            workspace: bridge?.hello?.workspaceName ?? null,
            workspaceId: bridge?.hello?.workspaceId ?? null,
            tools: (bridge?.tools ?? []).map(t => t.name),
          },
          null,
          2
        )
      );
    }
    if (!bridge) {
      return textResult(
        'Ứng dụng AFFiNE chưa mở hoặc chưa bật cầu nối MCP (Cài đặt → Cầu nối MCP).',
        true
      );
    }
    if (!bridge.tools.some(t => t.name === name)) {
      return textResult(`Không có công cụ "${name}".`, true);
    }
    try {
      const result = await callApp(name, args);
      return textResult(
        typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      );
    } catch (error) {
      return textResult(
        error instanceof Error ? error.message : String(error),
        true
      );
    }
  }

  async function handleRpc(msg) {
    if (Array.isArray(msg)) {
      const out = (await Promise.all(msg.map(handleRpc))).filter(Boolean);
      return out.length ? out : null;
    }
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return fail(msg?.id ?? null, -32600, 'Invalid Request');
    }
    const id = msg.id;
    const isNotification = id === undefined;
    try {
      switch (msg.method) {
        case 'initialize': {
          const requested = msg.params?.protocolVersion;
          return ok(id, {
            protocolVersion: SUPPORTED_PROTOCOLS.includes(requested)
              ? requested
              : SUPPORTED_PROTOCOLS[0],
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
            instructions:
              'Công cụ thao tác trực tiếp trên workspace AFFiNE đang mở. Gọi affine_status trước để xem trạng thái.',
          });
        }
        case 'ping':
          return ok(id, {});
        case 'tools/list':
          return ok(id, { tools: listTools() });
        case 'tools/call':
          return ok(id, await callTool(msg.params));
        default:
          if (isNotification) return null;
          return fail(id, -32601, 'Method not found');
      }
    } catch (error) {
      if (isNotification) return null;
      return fail(
        id,
        -32603,
        error instanceof Error ? error.message : 'Internal error'
      );
    }
  }

  function attachBridge(conn) {
    if (bridge) {
      bridge.conn.close(4000);
      rejectAllPending('Kết nối cầu nối bị thay thế');
    }
    const state = { conn, hello: null, tools: [] };
    bridge = state;
    log('app connected');

    conn.on('message', text => {
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (msg?.type === 'hello') {
        state.hello = {
          workspaceId: String(msg.workspaceId ?? ''),
          workspaceName: String(msg.workspaceName ?? ''),
        };
      } else if (msg?.type === 'tools' && Array.isArray(msg.tools)) {
        state.tools = msg.tools
          .filter(t => t && typeof t.name === 'string')
          .map(t => ({
            name: t.name,
            description: String(t.description ?? ''),
            inputSchema: t.inputSchema,
            write: Boolean(t.write),
          }));
      } else if (msg?.type === 'result' && pending.has(String(msg.id))) {
        const entry = pending.get(String(msg.id));
        pending.delete(String(msg.id));
        clearTimeout(entry.timer);
        if (msg.ok) entry.resolve(msg.result);
        else entry.reject(new Error(String(msg.error ?? 'Lỗi không rõ')));
      }
    });
    conn.on('close', () => {
      if (bridge === state) {
        bridge = null;
        rejectAllPending('Ứng dụng AFFiNE đã ngắt kết nối');
        log('app disconnected');
      }
    });
  }

  const sendJson = (res, status, body, headers = {}) => {
    const payload = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...headers,
    });
    res.end(payload);
  };

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY) {
          reject(new Error('Body too large'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  const server = http.createServer(async (req, res) => {
    if (!isAllowedHost(req.headers.host)) {
      return sendJson(res, 403, { error: 'Host not allowed' });
    }
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        bridge: Boolean(bridge),
        workspace: bridge?.hello?.workspaceName ?? null,
      });
    }
    if (url.pathname !== '/mcp')
      return sendJson(res, 404, { error: 'Not found' });

    if (!isAllowedOrigin(req.headers.origin, origins)) {
      return sendJson(res, 403, { error: 'Origin not allowed' });
    }
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ') || !safeEqual(auth.slice(7), token)) {
      return sendJson(
        res,
        401,
        { error: 'Unauthorized' },
        {
          'www-authenticate': 'Bearer',
        }
      );
    }

    if (req.method === 'POST') {
      let message;
      try {
        message = JSON.parse(await readBody(req));
      } catch {
        return sendJson(res, 400, fail(null, -32700, 'Parse error'));
      }
      const response = await handleRpc(message);
      if (response === null) {
        res.writeHead(202);
        return res.end();
      }
      return sendJson(res, 200, response);
    }
    if (req.method === 'DELETE') {
      res.writeHead(200);
      return res.end();
    }
    res.writeHead(405, { allow: 'POST, DELETE' });
    return res.end();
  });

  server.on('upgrade', (req, socket) => {
    const reject = status => {
      socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/bridge') return reject('404 Not Found');
    if (!isAllowedHost(req.headers.host)) return reject('403 Forbidden');
    if (!isAllowedOrigin(req.headers.origin, origins))
      return reject('403 Forbidden');

    const protocols = String(req.headers['sec-websocket-protocol'] ?? '')
      .split(',')
      .map(p => p.trim());
    const tokenProtocol = protocols.find(p => p.startsWith('token.'));
    if (
      !protocols.includes('affine-mcp') ||
      !tokenProtocol ||
      !safeEqual(tokenProtocol.slice(6), token)
    ) {
      return reject('401 Unauthorized');
    }
    const conn = acceptWebSocket(req, socket, { protocol: 'affine-mcp' });
    if (conn) attachBridge(conn);
  });

  const keepAlive = setInterval(() => bridge?.conn.ping(), 25_000);
  keepAlive.unref();

  return {
    handleRpc,
    start() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve(server.address().port);
        });
      });
    },
    stop() {
      clearInterval(keepAlive);
      bridge?.conn.close(1001);
      return new Promise(resolve => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
    },
  };
}
