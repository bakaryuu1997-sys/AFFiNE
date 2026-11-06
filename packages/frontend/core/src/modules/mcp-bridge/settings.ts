import { useSyncExternalStore } from 'react';

/**
 * Settings for the MCP bridge (agent <-> this app). Kept in this browser's
 * localStorage; the token never leaves the device except to the local bridge.
 */
export type McpBridgeSettings = {
  enabled: boolean;
  /** WebSocket address of the local bridge server */
  url: string;
  /** shared secret printed by the bridge (~/.affine-mcp/token) */
  token: string;
  /** let agents change the workspace; reading is always allowed */
  writeEnabled: boolean;
};

const STORAGE_KEY = 'affine-mcp-bridge-settings-v1';

export const DEFAULT_BRIDGE_URL = 'ws://127.0.0.1:20130/bridge';

export function createDefaultSettings(): McpBridgeSettings {
  return {
    enabled: false,
    url: DEFAULT_BRIDGE_URL,
    token: '',
    writeEnabled: true,
  };
}

function load(): McpBridgeSettings {
  const fallback = createDefaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<McpBridgeSettings>;
    return {
      enabled: parsed.enabled === true,
      url:
        typeof parsed.url === 'string' && parsed.url
          ? parsed.url
          : fallback.url,
      token: typeof parsed.token === 'string' ? parsed.token : '',
      writeEnabled: parsed.writeEnabled !== false,
    };
  } catch {
    return fallback;
  }
}

let current: McpBridgeSettings | null = null;
const listeners = new Set<() => void>();

export function getMcpBridgeSettings(): McpBridgeSettings {
  return (current ??= load());
}

export function updateMcpBridgeSettings(patch: Partial<McpBridgeSettings>) {
  current = { ...getMcpBridgeSettings(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // storage may be unavailable; keep the in-memory copy
  }
  listeners.forEach(listener => listener());
}

export function subscribeMcpBridgeSettings(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMcpBridgeSettings(): McpBridgeSettings {
  return useSyncExternalStore(
    subscribeMcpBridgeSettings,
    getMcpBridgeSettings,
    getMcpBridgeSettings
  );
}
