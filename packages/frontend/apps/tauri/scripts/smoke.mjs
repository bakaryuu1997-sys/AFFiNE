#!/usr/bin/env node
/**
 * Smoke test for the built desktop app (Windows). It starts the exe with the
 * WebView2 debugging port open, drives the real UI over the DevTools protocol
 * and exits 0 when everything looks right, 1 otherwise.
 *
 *   node scripts/smoke.mjs                       # installed app
 *   node scripts/smoke.mjs --exe C:\path\affine-personal.exe
 *   node scripts/smoke.mjs --docs 8 --keep       # open 8 docs, leave the app running
 *
 * What it checks (each one caught a real bug before):
 *  1. the app reaches a workspace within 60s (a bad CSP froze the main thread)
 *  2. no JS error or CSP violation while using it
 *  3. N different docs open from "All docs" and stay open (they used to bounce)
 *  4. no cloud leftovers (sign in / sync / share / Discord / AFFiNE Cloud) on
 *     the main screen, the workspace menu or the settings tabs
 *  5. page reload (F5 / location.reload()) cleanly reloads without freezing on splash screen
 * It only reads: it never types into a doc, so the user's data is untouched.
 * Note: it closes any running affine-personal.exe first.
 */
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i === -1
    ? fallback
    : process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined
      ? true
      : process.argv[i + 1];
};
const EXE = arg(
  'exe',
  path.join(
    process.env.LOCALAPPDATA ?? '',
    'AFFiNE Ca nhan',
    'affine-personal.exe'
  )
);
const PORT = Number(arg('port', 9333));
const DOCS = Number(arg('docs', 6));
const KEEP = process.argv.includes('--keep');
const BAD =
  /Sign in|Sign up|Đăng nhập|Đăng ký|AFFiNE Cloud|Enable Cloud|Syncing|Not signed|Discord|Chia sẻ|Invite|Upgrade/;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`
  );
};

try {
  execSync('taskkill /IM affine-personal.exe /F', { stdio: 'ignore' });
} catch {}
await sleep(1500);
const app = spawn(EXE, [], {
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
  },
  stdio: 'ignore',
  detached: true,
});
app.unref();

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const t = (
        await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      ).find(x => x.type === 'page');
      if (t) {
        const ws = new WebSocket(t.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
          ws.onopen = res;
          ws.onerror = rej;
        });
        return ws;
      }
    } catch {}
    await sleep(1000);
  }
  return null;
}
const ws = await connect();
if (!ws) {
  check('app starts and exposes the debug port', false);
  process.exit(1);
}
let id = 0;
const pend = new Map();
const caughtExceptions = [];

ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') {
    const desc =
      m.params?.exceptionDetails?.exception?.description ||
      m.params?.exceptionDetails?.text ||
      JSON.stringify(m.params?.exceptionDetails);
    caughtExceptions.push(desc);
  }
  if (m.id && pend.has(m.id)) {
    pend.get(m.id)(m);
    pend.delete(m.id);
  }
};
const send = (method, params = {}, ms = 5000) =>
  new Promise(r => {
    const i = ++id;
    pend.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
    setTimeout(() => r({ timeout: true }), ms);
  });

await send('Runtime.enable');
await send('Page.enable');
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__csp = window.__csp || [];
    window.__errs = window.__errs || [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.effectiveDirective + ' ' + e.blockedURI));
    window.addEventListener('error', e => window.__errs.push(e.message || String(e)));
  `,
});
const evalJs = async (expression, ms = 5000) => {
  const r = await send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    ms
  );
  return r.timeout ? { hung: true } : { value: r.result?.result?.value };
};
const click = async (x, y) => {
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
};
const title = async () => (await evalJs('document.title')).value ?? '';

// 1. reaches the workspace
let ready = false,
  hung = false;
for (let i = 0; i < 30 && !ready; i++) {
  await sleep(2000);
  const r = await evalJs(
    'document.title + "|" + document.body.innerText.length',
    3000
  );
  if (r.hung) {
    hung = true;
    continue;
  }
  hung = false;
  ready =
    /Tất cả tài liệu|All docs|すべてのドキュメント|·/.test(r.value ?? '') &&
    !(r.value ?? '').startsWith('AFFiNE|');
}
check(
  'reaches a workspace within 60s',
  ready,
  hung ? 'main thread unresponsive (CSP/eval freeze?)' : await title()
);
if (!ready) {
  if (!KEEP)
    execSync('taskkill /IM affine-personal.exe /F', { stdio: 'ignore' });
  process.exit(1);
}

await evalJs(
  `window.__csp=[];window.__errs=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.effectiveDirective+' '+e.blockedURI));addEventListener('error',e=>window.__errs.push(e.message));1`
);

// 4a. cloud leftovers on the main screen
const main = (await evalJs('document.body.innerText')).value ?? '';
check(
  'no cloud leftovers on the main screen',
  !BAD.test(main),
  main.match(BAD)?.[0] ?? ''
);

// open "All docs" from the sidebar
const goAll = async () => {
  const p = (
    await evalJs(
      `(()=>{const e=[...document.querySelectorAll('[data-testid=all-pages]')][0];if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]})()`
    )
  ).value;
  if (p) await click(p[0], p[1]);
  await sleep(2500);
};
await goAll();

// 3. docs open and stay open
let opened = 0,
  bounced = [];
for (let i = 0; i < DOCS; i++) {
  const row = (
    await evalJs(
      `(()=>{const e=document.querySelectorAll('[data-doc-id]')[${i}];if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),name:e.textContent.slice(0,24)}})()`
    )
  ).value;
  if (!row) break;
  await click(row.x, row.y);
  await sleep(3000);
  const t = await title();
  if (/^(Tất cả tài liệu|All docs)/.test(t)) bounced.push(row.name);
  else opened++;
  await goAll();
}
check(
  `${DOCS} docs open and stay open`,
  opened >= 1 && bounced.length === 0,
  `opened=${opened}${bounced.length ? ' bounced=' + bounced.join(', ') : ''}`
);

// 4b. workspace menu + settings tabs
const wsBtn = (
  await evalJs(
    `(()=>{const e=document.querySelector('[data-testid=current-workspace-card]');if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]})()`
  )
).value;
if (wsBtn) {
  await click(wsBtn[0], wsBtn[1]);
  await sleep(1500);
  const menu =
    (
      await evalJs(
        `(document.querySelector('[role=menu],[data-radix-popper-content-wrapper]')||document.body).innerText`
      )
    ).value ?? '';
  check(
    'workspace menu has no cloud entries',
    !BAD.test(menu),
    menu.match(BAD)?.[0] ?? ''
  );
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await sleep(500);
}
const st = (
  await evalJs(
    `(()=>{const e=document.querySelector('[data-testid=settings-modal-trigger]');if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]})()`
  )
).value;
if (st) {
  await click(st[0], st[1]);
  await sleep(2500);
  const n =
    (
      await evalJs(
        `document.querySelectorAll('[data-testid=settings-sidebar] [title]').length`
      )
    ).value ?? 0;
  let leak = '';
  for (let i = 0; i < n; i++) {
    await evalJs(
      `document.querySelectorAll('[data-testid=settings-sidebar] [title]')[${i}].click()`
    );
    await sleep(900);
    const text =
      (
        await evalJs(
          `(document.querySelector('[role=dialog]')||document.body).innerText`
        )
      ).value ?? '';
    const m = text.match(BAD);
    if (m) leak += `tab ${i}: ${m[0]}; `;
  }
  check(`settings: ${n} tabs, no cloud leftovers`, n >= 6 && !leak, leak);
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
}

// 5. page reload (F5 / location.reload()) recovers workspace and does not freeze on splash
await evalJs('location.reload()');
await sleep(2500);

let reloadReady = false,
  reloadHung = false;
for (let i = 0; i < 20 && !reloadReady; i++) {
  await sleep(1000);
  const r = await evalJs(
    'document.title + "|" + document.body.innerText.length',
    3000
  );
  if (r.hung) {
    reloadHung = true;
    continue;
  }
  reloadHung = false;
  reloadReady =
    /Tất cả tài liệu|All docs|すべてのドキュメント|·/.test(r.value ?? '') &&
    !(r.value ?? '').startsWith('AFFiNE|');
}
check(
  'page reload (F5) recovers workspace and does not freeze on splash',
  reloadReady && !reloadHung,
  reloadHung ? 'hung at splash screen' : await title()
);

// 2. errors while using the app
const csp =
  (await evalJs('JSON.stringify([...new Set(window.__csp || [])])')).value ??
  '[]';
const inPageErrs =
  (await evalJs('JSON.stringify((window.__errs || []).slice(0, 3))')).value ??
  '[]';
const pageErrList = (() => {
  try {
    return JSON.parse(inPageErrs);
  } catch {
    return [inPageErrs];
  }
})();
const allErrs = [...caughtExceptions, ...pageErrList];
check('no CSP violations', csp === '[]', csp);
check(
  'no uncaught JS errors',
  allErrs.length === 0,
  allErrs.length ? JSON.stringify(allErrs.slice(0, 3)) : ''
);

ws.close();
if (!KEEP) execSync('taskkill /IM affine-personal.exe /F', { stdio: 'ignore' });
const failed = results.filter(r => !r).length;
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
