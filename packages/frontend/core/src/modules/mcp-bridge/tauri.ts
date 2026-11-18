/**
 * When the app runs inside the Tauri desktop shell, the shell hosts the MCP
 * bridge itself and can hand the web app its address and token, so the person
 * does not have to copy them by hand.
 */

type TauriGlobal = {
  core?: {
    invoke?: (
      command: string,
      args?: Record<string, unknown>
    ) => Promise<unknown>;
  };
};

export interface TauriMcpInfo {
  url: string;
  token: string;
}

export interface McpClientStatus {
  client_id: string;
  client_name: string;
  installed: boolean;
  config_path: string | null;
  executable_path: string;
  client_type: 'file' | 'command';
  manual_command?: string | null;
}

export const APP_PERSONAL_VERSION = '0.3.0';

export function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__)
  );
}

function getFallbackMcpClients(): McpClientStatus[] {
  return [
    {
      client_id: 'claude',
      client_name: 'Claude Desktop',
      installed: false,
      config_path: '%APPDATA%\\Claude\\claude_desktop_config.json',
      executable_path: 'affine-personal.exe',
      client_type: 'file',
      manual_command: null,
    },
    {
      client_id: 'claude_code',
      client_name: 'Claude Code',
      installed: false,
      config_path: '~/.claude.json',
      executable_path: 'affine-personal.exe',
      client_type: 'command',
      manual_command:
        'claude mcp add --scope user affine affine-personal.exe -- --mcp',
    },
    {
      client_id: 'codex',
      client_name: 'Codex',
      installed: false,
      config_path: '~/.codex/config.toml',
      executable_path: 'affine-personal.exe',
      client_type: 'command',
      manual_command: 'codex mcp add affine -- affine-personal.exe --mcp',
    },
    {
      client_id: 'cursor',
      client_name: 'Cursor',
      installed: false,
      config_path: '~/.cursor/mcp.json',
      executable_path: 'affine-personal.exe',
      client_type: 'file',
      manual_command: null,
    },
    {
      client_id: 'windsurf',
      client_name: 'Windsurf',
      installed: false,
      config_path: '~/.codeium/windsurf/mcp_config.json',
      executable_path: 'affine-personal.exe',
      client_type: 'file',
      manual_command: null,
    },
    {
      client_id: 'antigravity',
      client_name: 'Antigravity',
      installed: false,
      config_path: '~/.gemini/antigravity/mcp_config.json',
      executable_path: 'affine-personal.exe',
      client_type: 'file',
      manual_command: null,
    },
  ];
}

/** Accepts only a well-formed { url, token } with a ws(s) address. */
export function parseMcpInfo(value: unknown): TauriMcpInfo | null {
  if (!value || typeof value !== 'object') return null;
  const { url, token } = value as Record<string, unknown>;
  if (typeof url !== 'string' || typeof token !== 'string') return null;
  if (!/^wss?:\/\//.test(url) || token.length < 16) return null;
  return { url, token };
}

/** Reads the desktop app version from Tauri's Cargo.toml, falling back outside Tauri. */
export async function fetchTauriAppVersion(): Promise<string> {
  if (!isTauri()) return APP_PERSONAL_VERSION;
  const invoke = (window as unknown as { __TAURI__: TauriGlobal }).__TAURI__
    .core?.invoke;
  if (!invoke) return APP_PERSONAL_VERSION;
  try {
    const version = await invoke('app_version');
    if (typeof version === 'string' && version.trim()) {
      return version.trim();
    }
    return APP_PERSONAL_VERSION;
  } catch {
    return APP_PERSONAL_VERSION;
  }
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

/** Asks the Tauri shell for MCP client statuses; falls back in browser. */
export async function fetchMcpClientStatuses(): Promise<McpClientStatus[]> {
  if (!isTauri()) return getFallbackMcpClients();
  const invoke = (window as unknown as { __TAURI__: TauriGlobal }).__TAURI__
    .core?.invoke;
  if (!invoke) return getFallbackMcpClients();
  try {
    const res = await invoke('get_mcp_status');
    if (Array.isArray(res)) return res as McpClientStatus[];
    return getFallbackMcpClients();
  } catch {
    return getFallbackMcpClients();
  }
}

/** Instructs the Tauri shell to install MCP config for a client. */
export async function installMcpClientConfig(
  clientId: string
): Promise<string> {
  if (!isTauri()) {
    throw new Error(
      'Chức năng cài đặt tự động yêu cầu ứng dụng AFFiNE Desktop.'
    );
  }
  const invoke = (window as unknown as { __TAURI__: TauriGlobal }).__TAURI__
    .core?.invoke;
  if (!invoke) {
    throw new Error('Tauri API không khả dụng.');
  }
  return (await invoke('install_mcp_config', { clientId })) as string;
}
