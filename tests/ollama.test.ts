import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
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

  it('handles replay mode misses and rejects unsupported models', async () => {
    const client = new OllamaClient({ mode: 'replay' });

    // Replay miss throws ReplayMissError
    await expect(
      client.chat({
        model: 'gemma4:e4b',
        promptVersion: 'v1',
        systemPrompt: 'sys',
        userPrompt: 'user',
        schemaHash: 'hash',
      }),
    ).rejects.toThrow(ReplayMissError);

    // Unsupported model throws
    await expect(
      client.chat({
        model: 'llama3:latest' as any,
        promptVersion: 'v1',
        systemPrompt: 'sys',
        userPrompt: 'user',
        schemaHash: 'hash',
      }),
    ).rejects.toThrow(/not supported/);
  });

  it('reports isReachable as false when Ollama endpoint is down', async () => {
    const client = new OllamaClient({ baseUrl: 'http://127.0.0.1:59999' });
    const reachable = await client.isReachable();
    expect(reachable).toBe(false);
  });

  it('reads cached fixture in replay mode when fixture file exists on disk', async () => {
    const tmpDir = path.resolve(process.cwd(), 'fixtures_test');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const client = new OllamaClient({ mode: 'replay', fixturesDir: tmpDir });
    const req = {
      model: OLLAMA_SUPPORTED_MODEL,
      promptVersion: 'v1.0.0',
      systemPrompt: 'test sys',
      userPrompt: 'test user',
      schemaHash: 'hash123',
    };
    const key = generateCacheKey(req);
    const fixtureFile = path.join(tmpDir, `${key}.json`);

    fs.writeFileSync(
      fixtureFile,
      JSON.stringify({
        model: 'gemma4:e4b',
        promptVersion: 'v1.0.0',
        cacheKey: key,
        data: { test: 'hello replay' },
        tokensPerSec: 45.2,
      }),
      'utf8',
    );

    try {
      const response = await client.chat<{ test: string }>(req);
      expect(response.data).toEqual({ test: 'hello replay' });
      expect(response.tokensPerSec).toBe(45.2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('checks isReachable with model availability via mock tags response', async () => {
    const client = new OllamaClient({ baseUrl: 'http://mock-ollama' });

    // Mock fetch tags with model present
    const origFetch = global.fetch;
    try {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/tags')) {
          return {
            ok: true,
            json: async () => ({
              models: [{ name: 'gemma4:e4b:latest' }, { name: 'other:latest' }],
            }),
          };
        }
        return { ok: false };
      }) as any;

      const hasModel = await client.isReachable();
      expect(hasModel).toBe(true);

      // Model absent
      global.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({ models: [{ name: 'other:latest' }] }),
      })) as any;

      const missingModel = await client.isReachable();
      expect(missingModel).toBe(false);
    } finally {
      global.fetch = origFetch;
    }
  });
});
