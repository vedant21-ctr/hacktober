import { describe, expect, it } from 'vitest';
import {
  OllamaClient,
  OLLAMA_SUPPORTED_MODEL,
  ReplayMissError,
  generateCacheKey,
} from '@decisionvault/server/llm/ollama';

describe('Ollama LLM Interface & Replay Mechanism', () => {
  it('enforces gemma4:e4b as the supported model', () => {
    expect(OLLAMA_SUPPORTED_MODEL).toBe('gemma4:e4b');
    const client = new OllamaClient();
    expect(client.model).toBe('gemma4:e4b');
  });

  it('defaults to replay mode when LLM_MODE is unset or specified', () => {
    const client = new OllamaClient({ mode: 'replay' });
    expect(client.mode).toBe('replay');

    const clientExplicit = new OllamaClient({ model: 'gemma4:e4b', mode: 'live' });
    expect(clientExplicit.mode).toBe('live');
    expect(clientExplicit.model).toBe('gemma4:e4b');

    process.env.LLM_MODE = 'live';
    const clientEnv = new OllamaClient();
    expect(clientEnv.mode).toBe('live');
    delete process.env.LLM_MODE;

    const clientDefault = new OllamaClient();
    expect(clientDefault.mode).toBe('replay');
  });

  it('generates deterministic SHA-256 cache keys', () => {
    const baseParams = {
      model: 'gemma4:e4b',
      promptVersion: 'v1.0.0',
      systemPrompt: 'You are an extraction assistant.',
      userPrompt: 'Extract decision from: [c1] Let us use Python 3.12.',
      schemaHash: 'a1b2c3d4e5',
    };

    const key1 = generateCacheKey(baseParams);
    const key2 = generateCacheKey({ ...baseParams });

    // Same input must produce identical key
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^[a-f0-9]{64}$/);

    // Any variation must produce a different key
    const differentUserPromptKey = generateCacheKey({
      ...baseParams,
      userPrompt: 'Extract decision from: [c2] Changed text.',
    });
    expect(key1).not.toBe(differentUserPromptKey);

    const differentVersionKey = generateCacheKey({
      ...baseParams,
      promptVersion: 'v1.0.1',
    });
    expect(key1).not.toBe(differentVersionKey);

    const differentSchemaKey = generateCacheKey({
      ...baseParams,
      schemaHash: 'f6e7d8c9b0',
    });
    expect(key1).not.toBe(differentSchemaKey);
  });

  it('instantiates ReplayMissError correctly with cache key and custom message', () => {
    const cacheKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const err = new ReplayMissError(cacheKey);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ReplayMissError');
    expect(err.cacheKey).toBe(cacheKey);
    expect(err.message).toContain(cacheKey);

    const customErr = new ReplayMissError(cacheKey, 'Custom replay failure');
    expect(customErr.message).toBe('Custom replay failure');
  });

  it('throws "Not implemented" for chat and isReachable without network calls in Phase 1/2A', async () => {
    const client = new OllamaClient({ mode: 'replay' });

    await expect(
      client.chat({
        model: 'gemma4:e4b',
        promptVersion: 'v1',
        systemPrompt: 'sys',
        userPrompt: 'user',
        schemaHash: 'hash',
      }),
    ).rejects.toThrow('Not implemented');

    await expect(client.isReachable()).rejects.toThrow('Not implemented');
  });
});
