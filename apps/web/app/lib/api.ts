/**
 * DecisionVault API Client
 *
 * Central API client with typed request/response interfaces.
 * Uses shared contracts from @decisionvault/shared.
 */

import type {
  StatusResponse,
  OverviewResponse,
  RepositoriesResponse,
  DecisionsResponse,
  DecisionDetail,
  ImportRequest,
  JobAcceptedResponse,
  Job,
  SourceDetailResponse,
  CodeTreeResponse,
  CodeWhyResponse,
  AskRequest,
  AskResponse,
  RadarResponse,
  TimelineResponse,
  RelationshipsResponse,
  PriorArtRequest,
  PriorArtReport,
  BenchmarkCasesResponse,
  BenchmarkRunRequest,
  BenchmarkRunAcceptedResponse,
  BenchmarkRun,
  BenchmarkConfirmRequest,
  BenchmarkConfirmResponse,
  ExtractRequest,
  ApiError,
} from '@decisionvault/shared/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorData: ApiError | null = null;
    try {
      errorData = await res.json();
    } catch {
      // response body wasn't JSON
    }
    throw new ApiClientError(
      res.status,
      errorData?.error?.code || 'UNKNOWN_ERROR',
      errorData?.error?.message || `Request failed with status ${res.status}`,
    );
  }
  return res.json();
}

async function get<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  const res = await fetch(url.toString());
  return handleResponse<T>(res);
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

// ─── Implemented Endpoints ──────────────────────────────────────────────────

export const api = {
  /** GET /api/status */
  getStatus: () => get<StatusResponse>('/api/status'),

  /** GET /api/overview */
  getOverview: (repoId?: number) => get<OverviewResponse>('/api/overview', { repoId }),

  /** GET /api/repositories */
  getRepositories: () => get<RepositoriesResponse>('/api/repositories'),

  /** POST /api/imports */
  importRepository: (data: ImportRequest) => post<JobAcceptedResponse>('/api/imports', data),

  /** POST /api/extract */
  extractDecisions: (data: ExtractRequest) => post<JobAcceptedResponse>('/api/extract', data),

  /** GET /api/jobs/:id */
  getJob: (id: number) => get<Job>(`/api/jobs/${id}`),

  /** GET /api/decisions */
  getDecisions: (params?: {
    repoId?: number;
    status?: string;
    lifecycle?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) =>
    get<DecisionsResponse>('/api/decisions', params as Record<string, string | number | undefined>),

  /** GET /api/decisions/:id */
  getDecisionDetail: (id: number) => get<DecisionDetail>(`/api/decisions/${id}`),

  /** GET /api/sources/:id */
  getSource: (id: number) => get<SourceDetailResponse>(`/api/sources/${id}`),

  // ─── Endpoints Under Development ────────────────────────────────────────────
  // These match the shared contract schemas.
  // They will return 501 NOT_IMPLEMENTED until the backend implements them.

  /** POST /api/ask — Ask DecisionVault (not yet implemented) */
  ask: (data: AskRequest) => post<AskResponse>('/api/ask', data),

  /** GET /api/code/tree — Code file tree (not yet implemented) */
  getCodeTree: (repoId?: number) => get<CodeTreeResponse>('/api/code/tree', { repoId }),

  /** GET /api/code/why — File-to-decision lookup (not yet implemented) */
  getCodeWhy: (repoId: number, path: string) =>
    get<CodeWhyResponse>('/api/code/why', { repoId, path }),

  /** GET /api/radar — Reopen Radar (not yet implemented) */
  getRadar: (repoId?: number, state?: string) =>
    get<RadarResponse>('/api/radar', { repoId, state }),

  /** POST /api/radar/recheck (not yet implemented) */
  recheckRadar: (data: { decisionId?: number; repoId?: number }) =>
    post<void>('/api/radar/recheck', data),

  /** GET /api/timeline/:decisionId (not yet implemented) */
  getTimeline: (decisionId: number) => get<TimelineResponse>(`/api/timeline/${decisionId}`),

  /** GET /api/relationships (not yet implemented) */
  getRelationships: (decisionId: number) =>
    get<RelationshipsResponse>('/api/relationships', { decisionId }),

  /** POST /api/sandbox/prior-art (not yet implemented) */
  runPriorArt: (data: PriorArtRequest) => post<PriorArtReport>('/api/sandbox/prior-art', data),

  /** GET /api/sandbox/reports/:id (not yet implemented) */
  getPriorArtReport: (id: number) => get<PriorArtReport>(`/api/sandbox/reports/${id}`),

  /** GET /api/benchmark/cases (not yet implemented) */
  getBenchmarkCases: () => get<BenchmarkCasesResponse>('/api/benchmark/cases'),

  /** POST /api/benchmark/run (not yet implemented) */
  runBenchmark: (data: BenchmarkRunRequest) =>
    post<BenchmarkRunAcceptedResponse>('/api/benchmark/run', data),

  /** GET /api/benchmark/runs/:id (not yet implemented) */
  getBenchmarkRun: (id: number) => get<BenchmarkRun>(`/api/benchmark/runs/${id}`),

  /** POST /api/benchmark/runs/:id/confirm (not yet implemented) */
  confirmBenchmark: (id: number, data: BenchmarkConfirmRequest) =>
    post<BenchmarkConfirmResponse>(`/api/benchmark/runs/${id}/confirm`, data),
};

export type Api = typeof api;
