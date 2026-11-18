import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

const conf = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../apps/tauri/src-tauri/tauri.conf.json',
      import.meta.url
    ),
    'utf8'
  )
) as { app: { security: { csp: string | null } } };

const directive = (csp: string, name: string) =>
  csp
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(name + ' '));

describe('Tauri CSP', () => {
  const csp = conf.app.security.csp;

  test('is set (not null)', () => {
    expect(typeof csp).toBe('string');
  });

  /**
   * Regression guard. A CSP whose script-src lacks 'unsafe-eval' makes the web
   * app hang its main thread forever at start-up (a bundled library falls back
   * to eval/new Function and spins when it is blocked). Verified by serving the
   * packaged app with and without the header. Do not remove it when tightening
   * the policy unless the app was re-tested in the built exe.
   */
  test("script-src keeps 'unsafe-eval' so the app can start", () => {
    const scriptSrc = directive(csp as string, 'script-src') ?? '';
    expect(scriptSrc).toContain("'unsafe-eval'");
  });

  test('still blocks inline scripts and remote script hosts', () => {
    const scriptSrc = directive(csp as string, 'script-src') ?? '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toMatch(/https?:|\*/);
  });
});
