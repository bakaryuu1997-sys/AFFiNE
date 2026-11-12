/**
 * When the app runs inside the Tauri desktop shell, the shell hosts the MCP
 * bridge itself and can hand the web app its address and token, so the person
 * does not have to copy them by hand.
 */

type TauriGlobal = {
  core?: { invoke?: (command: string) => Promise<unknown> };
};

export interface TauriMcpInfo {
  url: string;
  token: string;
}

export function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__)
  );
}

/** Accepts only a well-formed { url, token } with a ws(s) address. */
export function parseMcpInfo(value: unknown): TauriMcpInfo | null {
  if (!value || typeof value !== 'object') return null;
  const { url, token } = value as Record<string, unknown>;
  if (typeof url !== 'string' || typeof token !== 'string') return null;
  if (!/^wss?:\/\//.test(url) || token.length < 16) return null;
  return { url, token };
}

/** Asks the Tauri shell for the bridge settings; null outside Tauri. */
export async function fetchTauriMcpInfo(): Promise<TauriMcpInfo | null> {
  if (!isTauri()) return null;
  const invoke = (window as unknown as { __TAURI__: TauriGlobal }).__TAURI__
    .core?.invoke;
  if (!invoke) return null;
  try {
    return parseMcpInfo(await invoke('mcp_info'));
  } catch {
    return null;
  }
}
