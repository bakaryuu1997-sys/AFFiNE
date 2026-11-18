import { afterEach, describe, expect, test, vi } from 'vitest';

import { listModels } from '../client';
import { STANDARD_PROVIDERS } from '../settings';

describe('listModels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('skips network request and returns fallback models when cloud provider has no API key', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const openai = STANDARD_PROVIDERS.find(p => p.id === 'openai')!;
    expect(openai.apiKey).toBe('');

    const models = await listModels(openai, 'http://127.0.0.1:20129');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(models.length).toBeGreaterThan(0);
    expect(models).toContain('gpt-4o');
  });

  test('includes Google Gemini in STANDARD_PROVIDERS with official OpenAI-compatible endpoint', () => {
    const gemini = STANDARD_PROVIDERS.find(p => p.id === 'gemini');
    expect(gemini).toBeDefined();
    expect(gemini?.name).toBe('Google Gemini');
    expect(gemini?.baseUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai'
    );
    expect(gemini?.model).toBe('gemini-2.5-flash');
  });

  test('skips network request and returns curated Gemini fallback models when Gemini has no API key', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const gemini = STANDARD_PROVIDERS.find(p => p.id === 'gemini')!;

    const models = await listModels(gemini, 'http://127.0.0.1:20129');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(models).toContain('gemini-2.5-flash');
    expect(models).toContain('gemini-2.5-pro');
  });

  test('normalizes models/ prefix returned by Google Gemini OpenAI-compatible /models endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: 'models/gemini-2.5-flash' },
            { id: 'models/gemini-2.5-pro' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const gemini = {
      ...STANDARD_PROVIDERS.find(p => p.id === 'gemini')!,
      apiKey: 'AIzaSyTestKey123',
    };

    const models = await listModels(gemini, 'http://127.0.0.1:20129');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(models).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro']);
  });
});
