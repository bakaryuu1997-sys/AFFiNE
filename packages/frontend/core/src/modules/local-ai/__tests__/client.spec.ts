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
});
