import {
  AskRequest,
  AskResponse,
  AskResponseSchema,
  DecisionsQuery,
  DecisionsResponse,
  DecisionsResponseSchema,
  DecisionDetail,
  DecisionDetailSchema,
  ExtractRequest,
  ImportRequest,
  Job,
  JobAcceptedResponse,
  JobAcceptedResponseSchema,
  JobSchema,
  OverviewQuery,
  OverviewResponse,
  OverviewResponseSchema,
  PriorArtReport,
  PriorArtReportSchema,
  PriorArtRequest,
  RepositoriesResponse,
  RepositoriesResponseSchema,
  StatusResponse,
  StatusResponseSchema,
} from '@decisionvault/shared/api';

// Optional fixtures for offline contract verification mode
import statusFixture from '../../../shared/fixtures/api/status.json';
import repositoriesFixture from '../../../shared/fixtures/api/repositories.json';
import overviewFixture from '../../../shared/fixtures/api/overview.json';
import decisionsListFixture from '../../../shared/fixtures/api/decisions_list.json';
import decisionDetailFixture from '../../../shared/fixtures/api/decision_detail.json';
import priorArtReportFixture from '../../../shared/fixtures/api/prior_art_report.json';

export class ApiClientError extends Error {
  public status: number;
  public code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export class ApiNotImplementedError extends ApiClientError {
  constructor(message = 'This endpoint is scheduled for Phase 2 implementation.') {
    super(501, 'NOT_IMPLEMENTED', message);
    this.name = 'ApiNotImplementedError';
  }
}

const isMockMode = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_MODE === 'mock';

function getBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  return '';
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
  } catch (err) {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      err instanceof Error ? err.message : 'Network request failed',
    );
  }

  const text = await response.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiClientError(response.status, 'INVALID_JSON', 'Server returned invalid JSON');
  }

  if (response.status === 501) {
    const errorMsg =
      (json as { error?: { message?: string } })?.error?.message ||
      'This endpoint has not been implemented yet.';
    throw new ApiNotImplementedError(errorMsg);
  }

  if (!response.ok) {
    const errorObj = (json as { error?: { code?: string; message?: string } })?.error;
    throw new ApiClientError(
      response.status,
      errorObj?.code || 'HTTP_ERROR',
      errorObj?.message || `Request failed with status ${response.status}`,
    );
  }

  return json as T;
}

export const api = {
  async getStatus(): Promise<StatusResponse> {
    if (isMockMode) {
      return StatusResponseSchema.parse(statusFixture);
    }
    const data = await request<unknown>('/api/status');
    return StatusResponseSchema.parse(data);
  },

  async getRepositories(): Promise<RepositoriesResponse> {
    if (isMockMode) {
      return RepositoriesResponseSchema.parse(repositoriesFixture);
    }
    const data = await request<unknown>('/api/repositories');
    return RepositoriesResponseSchema.parse(data);
  },

  async getOverview(repoId?: number): Promise<OverviewResponse> {
    if (isMockMode) {
      return OverviewResponseSchema.parse(overviewFixture);
    }
    const searchParams = new URLSearchParams();
    if (repoId !== undefined) searchParams.set('repoId', String(repoId));
    const query = searchParams.toString();
    const data = await request<unknown>(`/api/overview${query ? `?${query}` : ''}`);
    return OverviewResponseSchema.parse(data);
  },

  async getDecisions(query?: DecisionsQuery): Promise<DecisionsResponse> {
    if (isMockMode) {
      return DecisionsResponseSchema.parse(decisionsListFixture);
    }
    const searchParams = new URLSearchParams();
    if (query?.repoId !== undefined) searchParams.set('repoId', String(query.repoId));
    if (query?.status) searchParams.set('status', query.status);
    if (query?.lifecycle) searchParams.set('lifecycle', query.lifecycle);
    if (query?.q) searchParams.set('q', query.q);
    if (query?.page) searchParams.set('page', String(query.page));
    if (query?.pageSize) searchParams.set('pageSize', String(query.pageSize));

    const qs = searchParams.toString();
    const data = await request<unknown>(`/api/decisions${qs ? `?${qs}` : ''}`);
    return DecisionsResponseSchema.parse(data);
  },

  async getDecision(id: number): Promise<DecisionDetail> {
    if (isMockMode) {
      return DecisionDetailSchema.parse(decisionDetailFixture);
    }
    const data = await request<unknown>(`/api/decisions/${id}`);
    return DecisionDetailSchema.parse(data);
  },

  async createImport(data: ImportRequest): Promise<JobAcceptedResponse> {
    const res = await request<unknown>('/api/imports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return JobAcceptedResponseSchema.parse(res);
  },

  async getJob(id: number): Promise<Job> {
    const data = await request<unknown>(`/api/jobs/${id}`);
    return JobSchema.parse(data);
  },

  async checkPriorArt(data: PriorArtRequest): Promise<JobAcceptedResponse> {
    const res = await request<unknown>('/api/sandbox/prior-art', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return JobAcceptedResponseSchema.parse(res);
  },

  async getPriorArtReport(id: number): Promise<PriorArtReport> {
    if (isMockMode) {
      return PriorArtReportSchema.parse(priorArtReportFixture);
    }
    const data = await request<unknown>(`/api/sandbox/reports/${id}`);
    return PriorArtReportSchema.parse(data);
  },

  // Fixture providers for review and fallback preview
  fixtures: {
    status: () => StatusResponseSchema.parse(statusFixture),
    repositories: () => RepositoriesResponseSchema.parse(repositoriesFixture),
    overview: () => OverviewResponseSchema.parse(overviewFixture),
    decisions: () => DecisionsResponseSchema.parse(decisionsListFixture),
    decisionDetail: () => DecisionDetailSchema.parse(decisionDetailFixture),
    priorArtReport: () => PriorArtReportSchema.parse(priorArtReportFixture),
  },
};
