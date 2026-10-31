import type { Database as DatabaseType } from 'better-sqlite3';
import { normalizeText } from '@decisionvault/shared/normalize';
import type { AuthorRole, SourceKind } from '@decisionvault/shared/enums';
import { getDatabase } from '../db/index.js';
import { jobManager } from '../jobs.js';

export class IngestError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'INGEST_ERROR',
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'IngestError';
  }
}

/**
 * Maximum character limit for stored comment bodies to defend against payload amplification.
 */
const MAX_COMMENT_LENGTH = 65536;

/**
 * Validates and extracts owner and repository name from various GitHub input formats.
 * Defends against SSRF, directory traversal, and invalid URI schemes.
 */
export function parseGitHubTarget(target: string): { owner: string; repo: string } {
  if (!target || typeof target !== 'string') {
    throw new IngestError('Target repository is required', 'VALIDATION_ERROR', 400);
  }

  let cleaned = target.trim();

  // Strip git@github.com: prefix
  if (cleaned.startsWith('git@github.com:')) {
    cleaned = cleaned.replace(/^git@github\.com:/, '');
  } else if (/^https?:\/\//i.test(cleaned)) {
    try {
      const url = new URL(cleaned);
      if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
        throw new IngestError(
          `Untrusted host '${url.hostname}'. Only official github.com repositories are permitted.`,
          'SSRF_REJECTED',
          400,
        );
      }
      cleaned = url.pathname;
    } catch (err) {
      if (err instanceof IngestError) throw err;
      throw new IngestError('Invalid GitHub URL structure', 'VALIDATION_ERROR', 400);
    }
  }

  // Strip leading/trailing slashes and .git suffix in linear time (replaces ReDoS-prone polynomial regex)
  while (cleaned.startsWith('/')) {
    cleaned = cleaned.slice(1);
  }
  while (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  if (cleaned.toLowerCase().endsWith('.git')) {
    cleaned = cleaned.slice(0, -4);
  }
  while (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }

  const parts = cleaned.split('/');
  if (parts.length !== 2) {
    throw new IngestError(
      "Invalid GitHub repository target format. Expected 'owner/repo' or 'https://github.com/owner/repo'",
      'VALIDATION_ERROR',
      400,
    );
  }

  const [owner, repo] = parts;

  // Strict GitHub naming rules:
  // Owner: alphanumeric, single hyphens inside, max 39 chars
  // Repo: alphanumeric, dots, hyphens, underscores, max 100 chars, no '..'
  const ownerRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
  const repoRegex = /^[a-zA-Z0-9_.-]+$/;

  if (
    !ownerRegex.test(owner) ||
    !repoRegex.test(repo) ||
    owner.length > 39 ||
    repo.length > 100 ||
    repo === '.' ||
    repo === '..' ||
    repo.includes('..')
  ) {
    throw new IngestError(
      `Invalid repository identifier '${owner}/${repo}'. Path traversal or invalid characters detected.`,
      'VALIDATION_ERROR',
      400,
    );
  }

  return { owner, repo };
}

/**
 * Maps GitHub's author_association to DecisionVault's frozen author_role values.
 */
export function mapAuthorRole(association?: string | null): AuthorRole {
  if (!association) return 'unknown';
  switch (association.toUpperCase()) {
    case 'OWNER':
      return 'owner';
    case 'MEMBER':
      return 'member';
    case 'COLLABORATOR':
      return 'collaborator';
    case 'CONTRIBUTOR':
    case 'FIRST_TIME_CONTRIBUTOR':
      return 'contributor';
    case 'FIRST_TIMER':
    case 'NONE':
      return 'none';
    default:
      return 'unknown';
  }
}

export interface GitHubIngestOptions {
  db?: DatabaseType;
  fetchFn?: typeof fetch;
  token?: string;
  delayMs?: number;
}

export interface IngestResult {
  repoId: number;
  fullName: string;
  sourcesCount: number;
  commentsCount: number;
}

interface StagedComment {
  externalId: string;
  parentExternalId?: string | null;
  author: string;
  authorRole: AuthorRole;
  createdAt: string;
  body: string;
  url: string;
}

export class GitHubIngestService {
  private db: DatabaseType;
  private fetchFn: typeof fetch;
  private token?: string;
  private delayMs: number;

  constructor(options: GitHubIngestOptions = {}) {
    this.db = options.db || getDatabase();
    this.fetchFn = options.fetchFn || globalThis.fetch;
    this.token = options.token || process.env.GITHUB_TOKEN;
    this.delayMs = options.delayMs || 0;
  }

  private getHeaders(etag?: string | null): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'DecisionVault-Ingest/0.1.0',
      Accept: 'application/vnd.github.v3+json',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    if (etag) {
      headers['If-None-Match'] = etag;
    }
    return headers;
  }

  /**
   * Fetches an official GitHub API endpoint with ETag caching, rate limit detection, redirect restriction, and bounded retry.
   */
  async fetchGitHubApi<T = unknown>(
    apiPath: string,
    retries = 2,
  ): Promise<{ data: T; rawId: number }> {
    // SSRF Restriction: Enforce strict official GitHub API origin
    const url = `https://api.github.com${apiPath}`;

    // Check raw_responses cache for ETag
    const cached = this.db
      .prepare('SELECT id, etag, body FROM raw_responses WHERE request_key = ? AND provider = ?')
      .get(url, 'github') as { id: number; etag: string | null; body: string } | undefined;

    let res: Response;
    try {
      res = await this.fetchFn(url, {
        headers: this.getHeaders(cached?.etag),
        redirect: 'manual', // Prevent silent redirects to arbitrary destinations (SSRF defense)
      });
    } catch (err) {
      if (retries > 0) {
        if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs));
        return this.fetchGitHubApi<T>(apiPath, retries - 1);
      }
      throw new IngestError(
        `Network error contacting GitHub API: ${err instanceof Error ? err.message : String(err)}`,
        'NETWORK_ERROR',
        502,
      );
    }

    // Handle redirects defensively
    if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
      const location = res.headers.get('location');
      if (!location || !location.startsWith('https://api.github.com/')) {
        throw new IngestError(
          `Redirect rejected: outbound request redirected to untrusted destination '${location}'.`,
          'SSRF_REJECTED',
          400,
        );
      }
      const redirectedPath = location.replace('https://api.github.com', '');
      return this.fetchGitHubApi<T>(redirectedPath, retries);
    }

    // 304 Not Modified: Reuse cached body
    if (res.status === 304 && cached) {
      return {
        data: JSON.parse(cached.body) as T,
        rawId: cached.id,
      };
    }

    // 404 Not Found
    if (res.status === 404) {
      throw new IngestError(
        `Target resource '${apiPath}' was not found on GitHub. Verify the repository is public and correctly spelled.`,
        'NOT_FOUND',
        404,
      );
    }

    // Rate Limit / Forbidden
    if (res.status === 403 || res.status === 429) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      const resetTime = res.headers.get('x-ratelimit-reset');
      const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000).toISOString() : 'soon';
      if (remaining === '0' || res.status === 429) {
        throw new IngestError(
          `GitHub API rate limit exceeded. Window resets at ${resetDate}. Provide GITHUB_TOKEN for higher limits.`,
          'RATE_LIMITED',
          429,
        );
      }
      throw new IngestError('Access forbidden by GitHub API', 'FORBIDDEN', 403);
    }

    // 5xx Server Errors with bounded retry
    if (res.status >= 500) {
      if (retries > 0) {
        if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs));
        return this.fetchGitHubApi<T>(apiPath, retries - 1);
      }
      throw new IngestError(
        `GitHub API server error: HTTP ${res.status}`,
        'GITHUB_SERVER_ERROR',
        502,
      );
    }

    if (!res.ok) {
      throw new IngestError(
        `GitHub API request failed with HTTP ${res.status}`,
        'API_ERROR',
        res.status,
      );
    }

    const textBody = await res.text();
    const data = JSON.parse(textBody) as T;
    const etag = res.headers.get('etag');
    const now = new Date().toISOString();

    // Persist into raw_responses for idempotent replay and offline re-extraction
    const rawResult = this.db
      .prepare(
        `INSERT INTO raw_responses (provider, request_key, http_status, etag, fetched_at, body)
         VALUES ('github', ?, ?, ?, ?, ?)
         ON CONFLICT(request_key) DO UPDATE SET
           http_status = excluded.http_status,
           etag = excluded.etag,
           fetched_at = excluded.fetched_at,
           body = excluded.body
         RETURNING id`,
      )
      .get(url, res.status, etag, now, textBody) as { id: number };

    return {
      data,
      rawId: rawResult.id,
    };
  }

  /**
   * Imports a single public GitHub repository, its issues, pull requests, and comments.
   */
  async ingestRepository(jobId: number, target: string, limit?: number): Promise<IngestResult> {
    const { owner, repo } = parseGitHubTarget(target);
    const fullName = `${owner}/${repo}`;

    jobManager.updateJob(jobId, {
      status: 'running',
      stage: 'ingest',
      target: fullName,
      progress: { done: 0, total: 1 },
    });

    try {
      // 1. Fetch Repository Metadata
      const repoResp = await this.fetchGitHubApi<{
        id: number;
        full_name: string;
        default_branch: string;
      }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);

      const defaultBranch = repoResp.data.default_branch || 'main';
      const now = new Date().toISOString();

      // Persist repository
      const repoRow = this.db
        .prepare(
          `INSERT INTO repositories (full_name, default_branch, head_commit_sha, clone_path, imported_at)
           VALUES (?, ?, NULL, NULL, ?)
           ON CONFLICT(full_name) DO UPDATE SET
             default_branch = excluded.default_branch,
             imported_at = excluded.imported_at
           RETURNING id`,
        )
        .get(fullName, defaultBranch, now) as { id: number };

      const repoId = repoRow.id;
      jobManager.updateJob(jobId, { repoId });

      // 2. Fetch Issues and Pull Requests with pagination
      const maxItems = limit && limit > 0 ? limit : 50;
      let page = 1;
      const allIssues: Array<{
        id: number;
        number: number;
        title: string;
        body: string | null;
        state: string;
        created_at: string;
        closed_at: string | null;
        html_url: string;
        author_association?: string;
        user?: { login: string };
        pull_request?: {
          url: string;
          html_url: string;
          merged_at?: string | null;
        };
      }> = [];

      while (allIssues.length < maxItems) {
        const perPage = Math.min(100, maxItems - allIssues.length);
        const issuesResp = await this.fetchGitHubApi<typeof allIssues>(
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=all&per_page=${perPage}&page=${page}`,
        );

        if (!Array.isArray(issuesResp.data) || issuesResp.data.length === 0) {
          break;
        }

        allIssues.push(...issuesResp.data);
        if (issuesResp.data.length < perPage) {
          break;
        }
        page++;
      }

      jobManager.updateJob(jobId, {
        progress: { done: 0, total: allIssues.length },
      });

      // Prepare atomic SQLite transaction for persisting a source and all its comments
      const persistSourceAndComments = this.db.transaction(
        (
          sourceParams: {
            repoId: number;
            kind: SourceKind;
            externalId: string;
            url: string;
            title: string;
            state: string;
            createdAt: string;
            closedAt: string | null;
          },
          commentsList: StagedComment[],
        ) => {
          const sourceRow = this.db
            .prepare(
              `INSERT INTO sources (repo_id, kind, external_id, url, title, state, created_at, closed_at, base_commit_sha, raw_response_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
               ON CONFLICT(external_id) DO UPDATE SET
                 title = excluded.title,
                 state = excluded.state,
                 closed_at = excluded.closed_at
               RETURNING id`,
            )
            .get(
              sourceParams.repoId,
              sourceParams.kind,
              sourceParams.externalId,
              sourceParams.url,
              sourceParams.title,
              sourceParams.state,
              sourceParams.createdAt,
              sourceParams.closedAt,
            ) as { id: number };

          const sourceId = sourceRow.id;
          let idx = 0;

          // Phase 1: Insert/update all comments with content and position
          for (const c of commentsList) {
            const bodyNorm = normalizeText(c.body);
            this.db
              .prepare(
                `INSERT INTO comments (source_id, external_id, parent_comment_id, idx, author, author_role, created_at, body, body_norm, url)
                 VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(source_id, external_id) DO UPDATE SET
                   body = excluded.body,
                   body_norm = excluded.body_norm,
                   author_role = excluded.author_role`,
              )
              .run(
                sourceId,
                c.externalId,
                idx++,
                c.author,
                c.authorRole,
                c.createdAt,
                c.body,
                bodyNorm,
                c.url,
              );
          }

          // Phase 2: Resolve parent_comment_id for threaded replies now that all comments are staged
          for (const c of commentsList) {
            if (c.parentExternalId) {
              const parentRow = this.db
                .prepare('SELECT id FROM comments WHERE source_id = ? AND external_id = ?')
                .get(sourceId, c.parentExternalId) as { id: number } | undefined;

              if (parentRow) {
                this.db
                  .prepare(
                    'UPDATE comments SET parent_comment_id = ? WHERE source_id = ? AND external_id = ?',
                  )
                  .run(parentRow.id, sourceId, c.externalId);
              }
            }
          }

          return { sourceId, commentsCount: commentsList.length };
        },
      );

      let sourcesCount = 0;
      let totalCommentsCount = 0;

      // 3. Process each issue/PR in an atomic transaction
      for (let i = 0; i < allIssues.length; i++) {
        const issue = allIssues[i];
        const isPr = Boolean(issue.pull_request);
        const kind: SourceKind = isPr ? 'github_pr' : 'github_issue';
        const externalId = `${fullName}#${issue.number}`;

        let state = issue.state;
        if (isPr && issue.pull_request?.merged_at) {
          state = 'merged';
        }

        const stagedComments: StagedComment[] = [];

        // Comment 0: The issue/PR body description
        const rawIssueBody = issue.body || '';
        const safeIssueBody =
          rawIssueBody.length > MAX_COMMENT_LENGTH
            ? rawIssueBody.slice(0, MAX_COMMENT_LENGTH)
            : rawIssueBody;
        const author = issue.user?.login || 'ghost';
        const authorRole = mapAuthorRole(issue.author_association);

        stagedComments.push({
          externalId: `desc-${issue.id}`,
          author,
          authorRole,
          createdAt: issue.created_at,
          body: safeIssueBody,
          url: issue.html_url,
        });

        // Fetch discussion comments with pagination (bounded to max 10 pages)
        try {
          let commentPage = 1;
          while (commentPage <= 10) {
            const commentsResp = await this.fetchGitHubApi<
              Array<{
                id: number;
                body: string;
                created_at: string;
                html_url: string;
                author_association?: string;
                user?: { login: string };
              }>
            >(
              `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issue.number}/comments?per_page=100&page=${commentPage}`,
            );

            if (!Array.isArray(commentsResp.data) || commentsResp.data.length === 0) {
              break;
            }

            for (const c of commentsResp.data) {
              const rawBody = c.body || '';
              const safeBody =
                rawBody.length > MAX_COMMENT_LENGTH
                  ? rawBody.slice(0, MAX_COMMENT_LENGTH)
                  : rawBody;
              stagedComments.push({
                externalId: `c-${c.id}`,
                author: c.user?.login || 'ghost',
                authorRole: mapAuthorRole(c.author_association),
                createdAt: c.created_at,
                body: safeBody,
                url: c.html_url,
              });
            }

            if (commentsResp.data.length < 100) {
              break;
            }
            commentPage++;
          }
        } catch (commentErr) {
          console.error(`Warning: Failed to fetch issue comments for ${externalId}:`, commentErr);
        }

        // If it is a pull request, also fetch PR review comments with pagination
        if (isPr) {
          try {
            let prCommentPage = 1;
            while (prCommentPage <= 10) {
              const prCommentsResp = await this.fetchGitHubApi<
                Array<{
                  id: number;
                  in_reply_to_id?: number;
                  body: string;
                  created_at: string;
                  html_url: string;
                  author_association?: string;
                  user?: { login: string };
                }>
              >(
                `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${issue.number}/comments?per_page=100&page=${prCommentPage}`,
              );

              if (!Array.isArray(prCommentsResp.data) || prCommentsResp.data.length === 0) {
                break;
              }

              for (const rc of prCommentsResp.data) {
                const rawBody = rc.body || '';
                const safeBody =
                  rawBody.length > MAX_COMMENT_LENGTH
                    ? rawBody.slice(0, MAX_COMMENT_LENGTH)
                    : rawBody;
                stagedComments.push({
                  externalId: `rc-${rc.id}`,
                  parentExternalId: rc.in_reply_to_id ? `rc-${rc.in_reply_to_id}` : undefined,
                  author: rc.user?.login || 'ghost',
                  authorRole: mapAuthorRole(rc.author_association),
                  createdAt: rc.created_at,
                  body: safeBody,
                  url: rc.html_url,
                });
              }

              if (prCommentsResp.data.length < 100) {
                break;
              }
              prCommentPage++;
            }
          } catch (prErr) {
            console.error(`Warning: Failed to fetch PR review comments for ${externalId}:`, prErr);
          }
        }

        // Atomically write source and its comments to SQLite
        const result = persistSourceAndComments(
          {
            repoId,
            kind,
            externalId,
            url: issue.html_url,
            title: issue.title,
            state,
            createdAt: issue.created_at,
            closedAt: issue.closed_at,
          },
          stagedComments,
        );

        sourcesCount++;
        totalCommentsCount += result.commentsCount;

        // Update progress
        jobManager.updateJob(jobId, {
          progress: { done: i + 1, total: allIssues.length },
        });
      }

      jobManager.updateJob(jobId, {
        status: 'succeeded',
        stage: 'done',
        progress: { done: allIssues.length, total: allIssues.length },
        finishedAt: new Date().toISOString(),
      });

      return {
        repoId,
        fullName,
        sourcesCount,
        commentsCount: totalCommentsCount,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      jobManager.updateJob(jobId, {
        status: 'failed',
        error: message,
        finishedAt: new Date().toISOString(),
      });
      throw err;
    }
  }
}
