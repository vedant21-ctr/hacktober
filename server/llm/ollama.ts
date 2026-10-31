import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { LlmFailureCategory, LlmMode } from '@decisionvault/shared/enums';

export const OLLAMA_SUPPORTED_MODEL = 'gemma4:e4b' as const;
export type SupportedModel = typeof OLLAMA_SUPPORTED_MODEL;

export class ReplayMissError extends Error {
  constructor(
    public readonly cacheKey: string,
    message?: string,
  ) {
    super(message || `Replay fixture missing for cache key: ${cacheKey}`);
    this.name = 'ReplayMissError';
  }
}

export class OllamaConnectionError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'OllamaConnectionError';
  }
}

export interface LlmFailure {
  category: LlmFailureCategory;
  message: string;
  statusCode?: number;
  rawResponse?: string;
}

export interface OllamaChatRequest {
  model: SupportedModel;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  schemaHash: string;
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  seed?: number;
  numCtx?: number;
}

export interface OllamaChatResponse<T = unknown> {
  model: string;
  promptVersion: string;
  cacheKey: string;
  data: T;
  tokensPerSec?: number;
  durationMs?: number;
}

export interface CacheKeyParams {
  model: string;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  schemaHash: string;
}

/**
 * Generate a deterministic SHA-256 cache key using stable JSON serialization
 * to avoid field boundary concatenation collisions.
 */
export function generateCacheKey(params: CacheKeyParams): string {
  const stablePayload = JSON.stringify({
    model: params.model,
    promptVersion: params.promptVersion,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    schemaHash: params.schemaHash,
  });

  return crypto.createHash('sha256').update(stablePayload, 'utf8').digest('hex');
}

export interface OllamaClientOptions {
  baseUrl?: string;
  mode?: LlmMode;
  model?: SupportedModel;
  fixturesDir?: string;
  timeoutMs?: number;
}

export class OllamaClient {
  public readonly mode: LlmMode;
  public readonly model: SupportedModel;
  public readonly baseUrl: string;
  public readonly fixturesDir: string;
  public readonly timeoutMs: number;

  constructor(options: OllamaClientOptions = {}) {
    this.mode = options.mode || (process.env.LLM_MODE as LlmMode) || 'replay';
    this.model = options.model || OLLAMA_SUPPORTED_MODEL;
    this.baseUrl = options.baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    this.fixturesDir =
      options.fixturesDir || process.env.FIXTURES_DIR || path.resolve(process.cwd(), 'fixtures');
    this.timeoutMs = options.timeoutMs ?? 120000;
  }

  public async isReachable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const hasModel =
        data.models?.some((m) => m.name === this.model || m.name.startsWith(`${this.model}:`)) ??
        false;
      return hasModel;
    } catch {
      return false;
    }
  }

  public async chat<T>(request: OllamaChatRequest): Promise<OllamaChatResponse<T>> {
    if (request.model !== OLLAMA_SUPPORTED_MODEL) {
      throw new Error(
        `Model '${request.model}' is not supported. Only '${OLLAMA_SUPPORTED_MODEL}' is permitted.`,
      );
    }

    const cacheKey = generateCacheKey({
      model: request.model,
      promptVersion: request.promptVersion,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      schemaHash: request.schemaHash,
    });

    if (this.mode === 'replay') {
      const fixturePath = path.join(this.fixturesDir, `${cacheKey}.json`);
      if (!fs.existsSync(fixturePath)) {
        throw new ReplayMissError(cacheKey);
      }
      const raw = fs.readFileSync(fixturePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        model: this.model,
        promptVersion: request.promptVersion,
        cacheKey,
        data: (parsed.data !== undefined ? parsed.data : parsed) as T,
        tokensPerSec: parsed.tokensPerSec,
        durationMs: parsed.durationMs,
      };
    }

    // Live or record mode
    const startTime = Date.now();
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
          stream: false,
          format: request.jsonSchema || 'json',
          options: {
            temperature: request.temperature ?? 0,
            seed: request.seed ?? 42,
            num_ctx: request.numCtx ?? 8192,
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new OllamaConnectionError(
        `Failed to connect to local Ollama instance at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new OllamaConnectionError(
        `Ollama returned HTTP ${res.status}: ${errBody || res.statusText}`,
        res.status,
      );
    }

    const durationMs = Date.now() - startTime;
    const body = (await res.json()) as {
      message?: { content?: string };
      eval_count?: number;
      eval_duration?: number;
    };

    const content = body.message?.content || '{}';
    let data: T;
    try {
      data = JSON.parse(content) as T;
    } catch (parseErr) {
      throw new Error(
        `Failed to parse Ollama JSON response: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}\nRaw response: ${content}`,
      );
    }

    let tokensPerSec: number | undefined;
    if (body.eval_count && body.eval_duration && body.eval_duration > 0) {
      tokensPerSec = body.eval_count / (body.eval_duration / 1e9);
    }

    const response: OllamaChatResponse<T> = {
      model: this.model,
      promptVersion: request.promptVersion,
      cacheKey,
      data,
      tokensPerSec,
      durationMs,
    };

    if (this.mode === 'record') {
      if (!fs.existsSync(this.fixturesDir)) {
        fs.mkdirSync(this.fixturesDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(this.fixturesDir, `${cacheKey}.json`),
        JSON.stringify(response, null, 2),
        'utf8',
      );
    }

    return response;
  }
}
