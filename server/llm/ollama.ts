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

  constructor(options: OllamaClientOptions = {}) {
    this.mode = options.mode || (process.env.LLM_MODE as LlmMode) || 'replay';
    this.model = options.model || OLLAMA_SUPPORTED_MODEL;
  }

  public async chat<T>(_request: OllamaChatRequest): Promise<OllamaChatResponse<T>> {
    throw new Error('Not implemented');
  }

  public async isReachable(): Promise<boolean> {
    throw new Error('Not implemented');
  }
}
