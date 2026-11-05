import type { AIProvider } from './settings';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function viaProxy(proxyUrl: string, url: string) {
  return `${proxyUrl.replace(/\/+$/, '')}/forward?u=${encodeURIComponent(url)}`;
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

export async function listModels(
  provider: AIProvider,
  proxyUrl: string,
  signal?: AbortSignal
): Promise<string[]> {
  const res = await request(provider, proxyUrl, 'models', {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders(provider) },
    signal,
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = await res.json();
  const items: Array<{ id?: string; name?: string }> = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.models)
      ? json.models
      : [];
  return items
    .map(m => m.id ?? m.name)
    .filter((id): id is string => typeof id === 'string')
    .sort((a, b) => a.localeCompare(b));
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
