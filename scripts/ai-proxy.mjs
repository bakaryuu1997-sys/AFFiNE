#!/usr/bin/env node
/**
 * Tiny local CORS proxy for the in-app AI panel.
 *
 * Some OpenAI-compatible servers (e.g. 9router) do not answer the browser's CORS
 * preflight, so the web app cannot call them directly. This proxy:
 *   - listens on 127.0.0.1 only
 *   - only accepts requests whose Origin is localhost / 127.0.0.1
 *   - only forwards to loopback / private-network targets (or hosts you add in
 *     AI_PROXY_ALLOW), so it cannot be abused as an open relay
 *   - streams responses through untouched (SSE works)
 *
 * Usage:  node scripts/ai-proxy.mjs            (default port 20129)
 *         AI_PROXY_PORT=20130 node scripts/ai-proxy.mjs
 *         pm2 start scripts/ai-proxy.mjs --name ai-proxy
 *
 * Request format:  <proxy>/forward?u=<url-encoded target URL>
 */
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const PORT = Number(process.env.AI_PROXY_PORT ?? 20129);
const HOST = process.env.AI_PROXY_HOST ?? '127.0.0.1';
const EXTRA_ALLOWED = new Set(
  (process.env.AI_PROXY_ALLOW ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
);

const HOP_BY_HOP = new Set([
  'host',
  'origin',
  'referer',
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'accept-encoding',
]);

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === 'host.docker.internal') return true;
  if (EXTRA_ALLOWED.has(h)) return true;
  if (net.isIPv6(h))
    return h === '::1' || h.startsWith('fc') || h.startsWith('fd');
  if (net.isIPv4(h)) {
    const [a, b] = h.split('.').map(Number);
    return (
      a === 127 ||
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  return false;
}

function isAllowedOrigin(origin) {
  if (!origin) return true; // non-browser clients
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization,content-type,accept,x-requested-with',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function fail(res, origin, status, message) {
  res.writeHead(status, {
    ...corsHeaders(origin),
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify({ error: message }));
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin))
    return fail(res, undefined, 403, 'origin not allowed');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (url.pathname === '/health') {
    res.writeHead(200, {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
    });
    return res.end('{"ok":true}');
  }
  if (url.pathname !== '/forward') return fail(res, origin, 404, 'not found');

  let target;
  try {
    target = new URL(url.searchParams.get('u') ?? '');
  } catch {
    return fail(res, origin, 400, 'invalid target url');
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    return fail(res, origin, 400, 'unsupported protocol');
  }
  if (!isPrivateHost(target.hostname)) {
    return fail(
      res,
      origin,
      403,
      `target host not allowed: ${target.hostname}`
    );
  }

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase()) && v !== undefined) headers[k] = v;
  }
  const client = target.protocol === 'https:' ? https : http;
  const upstream = client.request(
    target,
    { method: req.method, headers },
    upRes => {
      const outHeaders = { ...corsHeaders(origin) };
      for (const [k, v] of Object.entries(upRes.headers)) {
        const key = k.toLowerCase();
        if (
          key.startsWith('access-control-') ||
          key === 'transfer-encoding' ||
          key === 'connection'
        )
          continue;
        if (v !== undefined) outHeaders[k] = v;
      }
      res.writeHead(upRes.statusCode ?? 502, outHeaders);
      upRes.pipe(res);
    }
  );
  upstream.on('error', err => {
    if (!res.headersSent)
      fail(res, origin, 502, `upstream error: ${err.message}`);
    else res.destroy();
  });
  res.on('close', () => upstream.destroy());
  req.pipe(upstream);
});

server.listen(PORT, HOST, () => {
  console.log(
    `[ai-proxy] listening on http://${HOST}:${PORT}  (forward?u=<url>)`
  );
});
