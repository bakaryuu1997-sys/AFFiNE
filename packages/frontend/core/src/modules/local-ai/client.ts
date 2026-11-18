import type { AIProvider } from './settings';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function viaProxy(proxyUrl: string, url: string) {
  let effective = proxyUrl;
  if (typeof window !== 'undefined') {
    const loc = window.location.hostname;
    if (loc === 'localhost' && effective.includes('127.0.0.1')) {
      effective = effective.replace('127.0.0.1', 'localhost');
    } else if (loc === '127.0.0.1' && effective.includes('localhost')) {
      effective = effective.replace('localhost', '127.0.0.1');
    }
  }
  return `${effective.replace(/\/+$/, '')}/forward?u=${encodeURIComponent(url)}`;
}

function authHeaders(provider: AIProvider): Record<string, string> {
  return provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {};
}

/**
 * fetch with a direct/proxy strategy. A network-level failure (typically CORS or
 * connection refused) falls through to the next route; HTTP errors do not.
 */
async function request(
  provider: AIProvider,
  proxyUrl: string,
  path: string,
  init: RequestInit
): Promise<Response> {
  const target = joinUrl(provider.baseUrl, path);
  const routes = provider.viaProxy
    ? [viaProxy(proxyUrl, target), target]
    : [target, viaProxy(proxyUrl, target)];

  let lastError: unknown;
  for (const url of routes) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
      lastError = error;
    }
  }
  throw new Error(
    `Không kết nối được tới ${provider.baseUrl} (${(lastError as Error)?.message ?? 'network error'})`
  );
}

async function readError(res: Response) {
  let text = '';
  try {
    text = await res.text();
    const json = JSON.parse(text);
    text = json?.error?.message ?? json?.error ?? text;
  } catch {
    // keep raw text
  }
  return `HTTP ${res.status}${text ? ` — ${String(text).slice(0, 300)}` : ''}`;
}

export interface TestModelResult {
  success: boolean;
  latencyMs: number;
  message: string;
}

export async function testModelConnection(
  provider: AIProvider,
  proxyUrl: string,
  model: string,
  signal?: AbortSignal
): Promise<TestModelResult> {
  const start = performance.now();
  try {
    const res = await request(provider, proxyUrl, 'chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...authHeaders(provider),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5,
        stream: false,
      }),
      signal,
    });
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) {
      const err = await readError(res);
      return { success: false, latencyMs, message: err };
    }
    return {
      success: true,
      latencyMs,
      message: `Kết nối thành công (${latencyMs}ms)`,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: false,
      latencyMs,
      message: (error as Error)?.message || 'Lỗi không xác định',
    };
  }
}

const CLOUD_KEY_REQUIRED_PROVIDERS = new Set([
  'openai',
  'gemini',
  'anthropic',
  'openrouter',
  'minimax',
]);

const PROVIDER_MODEL_FALLBACKS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini', 'gpt-4-turbo'],
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro',
  ],
  anthropic: [
    'claude-3-7-sonnet',
    'claude-3-5-sonnet',
    'claude-3-5-haiku',
    'claude-3-opus',
  ],
  minimax: ['MiniMax-Text-01', 'abab6.5s-chat'],
  openrouter: [
    'deepseek/deepseek-r1',
    'deepseek/deepseek-chat',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
  ],
  ollama: ['llama3.2', 'qwen2.5', 'mistral', 'deepseek-r1:8b', 'phi3'],
  '9router': [
    'free-logic',
    'gemini-2.0-flash',
    'deepseek-v3',
    'claude-3-5-sonnet',
  ],
};

function fallbackModelsFor(provider: AIProvider): string[] {
  return PROVIDER_MODEL_FALLBACKS[provider.id] || ['default'];
}

export async function listModels(
  provider: AIProvider,
  proxyUrl: string,
  signal?: AbortSignal
): Promise<string[]> {
  if (
    CLOUD_KEY_REQUIRED_PROVIDERS.has(provider.id) &&
    !provider.apiKey?.trim()
  ) {
    return fallbackModelsFor(provider);
  }

  // First try standard OpenAI /models endpoint
  try {
    const res = await request(provider, proxyUrl, 'models', {
      method: 'GET',
      headers: { Accept: 'application/json', ...authHeaders(provider) },
      signal,
    });
    if (res.ok) {
      const json = await res.json();
      const items: Array<{ id?: string; name?: string; model?: string }> =
        Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.models)
            ? json.models
            : [];
      const list = items
        .map(m => m.id ?? m.name ?? m.model)
        .filter((id): id is string => typeof id === 'string')
        .map(id => id.replace(/^models\//, ''))
        .sort((a, b) => a.localeCompare(b));
      if (list.length > 0) return list;
    }
  } catch {
    // fallback below
  }

  // Fallback for Ollama if baseUrl has /v1 or not: try api/tags
  if (provider.id === 'ollama' || provider.baseUrl.includes('11434')) {
    try {
      const ollamaBase = provider.baseUrl.replace(/\/v1\/?$/, '');
      const res = await request(
        { ...provider, baseUrl: ollamaBase },
        proxyUrl,
        'api/tags',
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal,
        }
      );
      if (res.ok) {
        const json = await res.json();
        const models = Array.isArray(json?.models)
          ? json.models
              .map((m: { name?: string; model?: string }) => m.name ?? m.model)
              .filter(Boolean)
          : [];
        if (models.length > 0) return models.sort();
      }
    } catch {
      // ignore
    }
  }

  return fallbackModelsFor(provider);
}

/** Streams a chat completion, calling `onDelta` with each text chunk. */
export async function streamChat(options: {
  provider: AIProvider;
  proxyUrl: string;
  model: string;
  messages: ChatMessage[];
  signal: AbortSignal;
  onDelta: (text: string) => void;
}): Promise<void> {
  const { provider, proxyUrl, model, messages, signal, onDelta } = options;
  const res = await request(provider, proxyUrl, 'chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json',
      ...authHeaders(provider),
    },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });
  if (!res.ok) throw new Error(await readError(res));

  const contentType = res.headers.get('content-type') ?? '';
  if (!res.body || contentType.includes('application/json')) {
    // server ignored stream:true
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text === 'string') onDelta(text);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) onDelta(delta);
      } catch {
        // ignore keep-alive / malformed lines
      }
    }
  }
}
