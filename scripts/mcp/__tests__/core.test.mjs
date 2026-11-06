/* oxlint-disable typescript/no-floating-promises -- node:test's describe/test return promises that the runner tracks itself */
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, test } from 'node:test';

import { createMcpServer, isAllowedOrigin } from '../core.mjs';

const TOKEN = 'a'.repeat(48);
let server;
let port;

const base = () => `http://127.0.0.1:${port}`;

async function rpc(method, params, { token = TOKEN, id = 1 } = {}) {
  const res = await fetch(`${base()}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  return {
    status: res.status,
    body: res.status === 202 ? null : await res.json(),
  };
}

function connectApp(protocols = ['affine-mcp', `token.${TOKEN}`]) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/bridge`, protocols);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', () => reject(new Error('connect failed')));
  });
}

const waitFor = async (predicate, ms = 2000) => {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > ms) throw new Error('timeout');
    await new Promise(r => setTimeout(r, 15));
  }
};

before(async () => {
  server = createMcpServer({ token: TOKEN, port: 0 });
  port = await server.start();
});
after(() => server.stop());

describe('http', () => {
  test('health needs no token', async () => {
    const res = await fetch(`${base()}/health`);
    assert.deepEqual(await res.json(), {
      ok: true,
      bridge: false,
      workspace: null,
    });
  });

  test('rejects a missing or wrong token', async () => {
    assert.equal((await rpc('ping', {}, { token: null })).status, 401);
    assert.equal(
      (await rpc('ping', {}, { token: 'b'.repeat(48) })).status,
      401
    );
  });

  test('rejects a foreign origin', async () => {
    const status = await new Promise((resolve, reject) => {
      const req = http.request(
        `${base()}/mcp`,
        {
          method: 'POST',
          headers: {
            origin: 'https://evil.example',
            authorization: `Bearer ${TOKEN}`,
            'content-type': 'application/json',
          },
        },
        res => {
          res.resume();
          resolve(res.statusCode);
        }
      );
      req.on('error', reject);
      req.end('{}');
    });
    assert.equal(status, 403);
  });

  test('rejects a non-loopback Host header', async () => {
    const status = await new Promise((resolve, reject) => {
      const req = http.request(
        `${base()}/health`,
        { headers: { host: 'evil.example' } },
        res => {
          res.resume();
          resolve(res.statusCode);
        }
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 403);
  });
});

describe('mcp protocol', () => {
  test('initialize echoes a supported protocol version', async () => {
    const { body } = await rpc('initialize', { protocolVersion: '2025-03-26' });
    assert.equal(body.result.protocolVersion, '2025-03-26');
    assert.equal(body.result.serverInfo.name, 'affine-mcp');
  });

  test('notifications get 202', async () => {
    const res = await fetch(`${base()}/mcp`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    });
    assert.equal(res.status, 202);
  });

  test('lists the built-in tool and reports a disconnected app', async () => {
    const list = await rpc('tools/list');
    assert.deepEqual(
      list.body.result.tools.map(t => t.name),
      ['affine_status']
    );
    const status = await rpc('tools/call', {
      name: 'affine_status',
      arguments: {},
    });
    assert.equal(
      JSON.parse(status.body.result.content[0].text).connected,
      false
    );
    const call = await rpc('tools/call', { name: 'read_doc', arguments: {} });
    assert.equal(call.body.result.isError, true);
  });

  test('unknown method is an error', async () => {
    const { body } = await rpc('nope');
    assert.equal(body.error.code, -32601);
  });
});

describe('app bridge', () => {
  test('refuses a wrong token', async () => {
    await assert.rejects(connectApp(['affine-mcp', `token.${'c'.repeat(48)}`]));
  });

  test('refuses a foreign origin on upgrade', async () => {
    const status = await new Promise((resolve, reject) => {
      const req = http.request(`${base()}/bridge`, {
        headers: {
          connection: 'Upgrade',
          upgrade: 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'sec-websocket-protocol': `affine-mcp, token.${TOKEN}`,
          origin: 'https://evil.example',
        },
      });
      req.on('upgrade', () => reject(new Error('should not upgrade')));
      req.on('response', res => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 403);
  });

  test('registers tools and relays calls, including large results', async () => {
    const ws = await connectApp();
    const big = 'x'.repeat(200_000);
    ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.type !== 'call') return;
      if (msg.tool === 'echo') {
        ws.send(
          JSON.stringify({
            type: 'result',
            id: msg.id,
            ok: true,
            result: { got: msg.args },
          })
        );
      } else if (msg.tool === 'big') {
        ws.send(
          JSON.stringify({ type: 'result', id: msg.id, ok: true, result: big })
        );
      } else {
        ws.send(
          JSON.stringify({
            type: 'result',
            id: msg.id,
            ok: false,
            error: 'boom',
          })
        );
      }
    });
    ws.send(
      JSON.stringify({
        type: 'hello',
        workspaceId: 'w1',
        workspaceName: 'Demo',
      })
    );
    ws.send(
      JSON.stringify({
        type: 'tools',
        tools: [
          { name: 'echo', description: 'echo', write: true },
          { name: 'big', description: 'big' },
          { name: 'fail', description: 'fail' },
        ],
      })
    );
    await waitFor(
      async () => (await rpc('tools/list')).body.result.tools.length === 4
    );

    const list = (await rpc('tools/list')).body.result.tools;
    assert.equal(
      list.find(t => t.name === 'echo').annotations.readOnlyHint,
      false
    );
    assert.equal(
      list.find(t => t.name === 'big').annotations.readOnlyHint,
      true
    );

    const echo = await rpc('tools/call', { name: 'echo', arguments: { a: 1 } });
    assert.deepEqual(JSON.parse(echo.body.result.content[0].text), {
      got: { a: 1 },
    });

    const bigRes = await rpc('tools/call', { name: 'big', arguments: {} });
    assert.equal(bigRes.body.result.content[0].text.length, 200_000);

    const failed = await rpc('tools/call', { name: 'fail', arguments: {} });
    assert.equal(failed.body.result.isError, true);
    assert.match(failed.body.result.content[0].text, /boom/);

    const status = await rpc('tools/call', {
      name: 'affine_status',
      arguments: {},
    });
    assert.equal(
      JSON.parse(status.body.result.content[0].text).workspace,
      'Demo'
    );

    ws.close();
    await waitFor(
      async () => (await rpc('tools/list')).body.result.tools.length === 1
    );
  });

  test('a call pending when the app disconnects fails cleanly', async () => {
    const ws = await connectApp();
    ws.addEventListener('message', () => ws.close());
    ws.send(
      JSON.stringify({
        type: 'tools',
        tools: [{ name: 'slow', description: 's' }],
      })
    );
    await waitFor(
      async () => (await rpc('tools/list')).body.result.tools.length === 2
    );
    const res = await rpc('tools/call', { name: 'slow', arguments: {} });
    assert.equal(res.body.result.isError, true);
    assert.match(res.body.result.content[0].text, /ngắt kết nối/);
  });
});

describe('isAllowedOrigin', () => {
  test('allows loopback and tauri, blocks others', () => {
    assert.equal(isAllowedOrigin(undefined), true);
    assert.equal(isAllowedOrigin('http://localhost:8080'), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:3000'), true);
    assert.equal(isAllowedOrigin('tauri://localhost'), true);
    assert.equal(isAllowedOrigin('http://tauri.localhost'), true);
    assert.equal(isAllowedOrigin('https://evil.example'), false);
    assert.equal(isAllowedOrigin('https://localhost.evil.example'), false);
    assert.equal(isAllowedOrigin('not a url'), false);
  });
});
