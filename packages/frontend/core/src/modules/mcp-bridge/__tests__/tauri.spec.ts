import { describe, expect, test } from 'vitest';

import { fetchTauriMcpInfo, isTauri, parseMcpInfo } from '../tauri';

describe('parseMcpInfo', () => {
  const token = 'a'.repeat(32);

  test('accepts a ws address with a real token', () => {
    expect(parseMcpInfo({ url: 'ws://127.0.0.1:20130/bridge', token })).toEqual(
      {
        url: 'ws://127.0.0.1:20130/bridge',
        token,
      }
    );
  });

  test('rejects anything else', () => {
    expect(parseMcpInfo(null)).toBeNull();
    expect(parseMcpInfo('x')).toBeNull();
    expect(parseMcpInfo({ url: 'http://x', token })).toBeNull();
    expect(parseMcpInfo({ url: 'ws://x', token: 'short' })).toBeNull();
    expect(parseMcpInfo({ url: 5, token })).toBeNull();
  });
});

describe('outside Tauri', () => {
  test('there is no shell to ask', async () => {
    expect(isTauri()).toBe(false);
    expect(await fetchTauriMcpInfo()).toBeNull();
  });
});
