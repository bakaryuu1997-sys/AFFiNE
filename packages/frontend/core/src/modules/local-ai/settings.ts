import { useSyncExternalStore } from 'react';

/**
 * Settings store for the in-app AI panel.
 *
 * Providers are any OpenAI-compatible endpoints (Ollama, LM Studio, OpenRouter,
 * OpenAI, Anthropic, DeepSeek, ...). Everything is kept in this client's localStorage;
 * API keys never leave the device except in requests to the provider you configured.
 */
export type AIProvider = {
  id: string;
  name: string;
  /** e.g. https://api.openai.com/v1 or http://localhost:11434/v1 */
  baseUrl: string;
  apiKey: string;
  /** try the local CORS proxy before a direct request */
  viaProxy: boolean;
  /** last model picked for this provider */
  model?: string;
};

export type LocalAISettings = {
  enabled: boolean;
  providers: AIProvider[];
  activeProviderId: string;
  proxyUrl: string;
  systemPrompt: string;
};

const STORAGE_KEY = 'affine-local-ai-settings-v1';

export const DEFAULT_PROXY_URL = 'http://127.0.0.1:20129';

export const STANDARD_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    viaProxy: false,
    model: 'gpt-4o',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: '',
    viaProxy: false,
    model: 'gemini-2.5-flash',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: '',
    viaProxy: false,
    model: 'claude-3-5-sonnet',
  },
  {
    id: 'ollama',
    name: 'Ollama (Cục bộ)',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    viaProxy: false,
    model: 'llama3.2',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    viaProxy: false,
    model: 'deepseek/deepseek-chat',
  },
  {
    id: 'custom-openai',
    name: 'OpenAI Compatible (Tự do)',
    baseUrl: 'http://localhost:8000/v1',
    apiKey: '',
    viaProxy: false,
    model: 'default',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.io/v1',
    apiKey: '',
    viaProxy: false,
    model: 'MiniMax-Text-01',
  },
  {
    id: '9router',
    name: '9Router',
    baseUrl: 'http://localhost:20128/v1',
    apiKey: '',
    viaProxy: false,
    model: 'free-logic',
  },
];

export function createDefaultSettings(): LocalAISettings {
  return {
    enabled: true,
    providers: [...STANDARD_PROVIDERS],
    activeProviderId: 'ollama',
    proxyUrl: DEFAULT_PROXY_URL,
    systemPrompt:
      'Bạn là trợ lý viết và ghi chú thông minh. Trả lời ngắn gọn, chuẩn xác, đúng trọng tâm bằng tiếng Việt định dạng Markdown.',
  };
}

function load(): LocalAISettings {
  const fallback = createDefaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<LocalAISettings>;
    const savedProviders = Array.isArray(parsed.providers)
      ? parsed.providers.filter(p => p && typeof p.id === 'string')
      : [];

    // Merge standard providers with saved ones so new providers are always available
    const mergedProviders: AIProvider[] = savedProviders.map(p => {
      const std = STANDARD_PROVIDERS.find(s => s.id === p.id);
      if (std) {
        return {
          ...std,
          ...p,
          apiKey: p.apiKey ?? std.apiKey,
          viaProxy: p.viaProxy !== undefined ? p.viaProxy : std.viaProxy,
          baseUrl: p.baseUrl || std.baseUrl,
        };
      }
      return p;
    });
    for (const std of STANDARD_PROVIDERS) {
      if (!mergedProviders.some(p => p.id === std.id)) {
        mergedProviders.push(std);
      }
    }

    const providers =
      mergedProviders.length > 0 ? mergedProviders : fallback.providers;

    return {
      enabled: parsed.enabled ?? true,
      providers,
      activeProviderId:
        providers.find(p => p.id === parsed.activeProviderId)?.id ??
        providers[0]?.id ??
        'ollama',
      proxyUrl: parsed.proxyUrl || fallback.proxyUrl,
      systemPrompt: parsed.systemPrompt ?? fallback.systemPrompt,
    };
  } catch {
    return fallback;
  }
}

let current: LocalAISettings | null = null;
const listeners = new Set<() => void>();

export function getLocalAISettings(): LocalAISettings {
  return (current ??= load());
}

export function updateLocalAISettings(
  updater: (prev: LocalAISettings) => LocalAISettings
) {
  current = updater(getLocalAISettings());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // storage may be unavailable (private mode); keep the in-memory copy
  }
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLocalAISettings(): LocalAISettings {
  return useSyncExternalStore(
    subscribe,
    getLocalAISettings,
    getLocalAISettings
  );
}

export function newProviderId() {
  return `p_${Math.random().toString(36).slice(2, 9)}`;
}
