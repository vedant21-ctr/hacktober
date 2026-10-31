import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabase, initDatabase } from '@decisionvault/server/db';
import {
  GitHubIngestService,
  IngestError,
  mapAuthorRole,
  parseGitHubTarget,
} from '../server/ingest/github.js';
import { jobManager } from '../server/jobs.js';

describe('GitHub Ingestion — URL Validation & SSRF Prevention', () => {
  it('accepts standard owner/repo format', () => {
    const res = parseGitHubTarget('facebook/react');
    expect(res).toEqual({ owner: 'facebook', repo: 'react' });
  });

  it('accepts full https github.com URLs with and without trailing slash or .git', () => {
    expect(parseGitHubTarget('https://github.com/facebook/react')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
    expect(parseGitHubTarget('https://github.com/facebook/react/')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
    expect(parseGitHubTarget('https://github.com/facebook/react.git')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
    expect(parseGitHubTarget('git@github.com:facebook/react.git')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('rejects SSRF attempts pointing to non-GitHub domains or internal IPs', () => {
    expect(() => parseGitHubTarget('https://evil.com/facebook/react')).toThrowError(IngestError);
    expect(() => parseGitHubTarget('http://localhost:8080/facebook/react')).toThrowError(
      IngestError,
    );
    expect(() => parseGitHubTarget('http://169.254.169.254/latest/meta-data')).toThrowError(
      IngestError,
    );
  });

  it('rejects path traversal and malformed inputs', () => {
    expect(() => parseGitHubTarget('')).toThrowError(IngestError);
    expect(() => parseGitHubTarget('   ')).toThrowError(IngestError);
    expect(() => parseGitHubTarget('justone')).toThrowError(IngestError);
    expect(() => parseGitHubTarget('owner/repo/extra')).toThrowError(IngestError);
    expect(() => parseGitHubTarget('../escaped')).toThrowError(IngestError);
    expect(() => parseGitHubTarget('owner/..')).toThrowError(IngestError);
    expect(() => parseGitHubTarget('invalid$owner/repo')).toThrowError(IngestError);
  });
});

describe('GitHub Ingestion — Author Role Mapping', () => {
  it('correctly maps GitHub author_association to DecisionVault author_role', () => {
    expect(mapAuthorRole('OWNER')).toBe('owner');
    expect(mapAuthorRole('MEMBER')).toBe('member');
    expect(mapAuthorRole('COLLABORATOR')).toBe('collaborator');
    expect(mapAuthorRole('CONTRIBUTOR')).toBe('contributor');
    expect(mapAuthorRole('FIRST_TIME_CONTRIBUTOR')).toBe('contributor');
    expect(mapAuthorRole('FIRST_TIMER')).toBe('none');
    expect(mapAuthorRole('NONE')).toBe('none');
    expect(mapAuthorRole('UNKNOWN_ROLE')).toBe('unknown');
    expect(mapAuthorRole(null)).toBe('unknown');
    expect(mapAuthorRole(undefined)).toBe('unknown');
  });
});

describe('GitHub Ingestion Service — Mocked Pipeline & Persistence', () => {
  beforeEach(() => {
    initDatabase(':memory:');
    jobManager.clear();
  });

  it('successfully imports repository, issues, PRs, and comments into SQLite', async () => {
    const db = getDatabase();

    const mockFetch = vi.fn(async (urlStr: string | URL | Request) => {
      const url = urlStr.toString();

      // Repo metadata
      if (url === 'https://api.github.com/repos/test-owner/test-repo') {
        return new Response(
          JSON.stringify({
            id: 12345,
            full_name: 'test-owner/test-repo',
            default_branch: 'main',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              etag: 'W/"repo-etag-1"',
            },
          },
        );
      }

      // Issues list
      if (url.includes('/issues?')) {
        return new Response(
          JSON.stringify([
            {
              id: 101,
              number: 1,
              title: 'Decision 1: Switch to TypeScript',
              body: 'Proposing that we migrate to TypeScript for type safety.',
              state: 'closed',
              created_at: '2026-01-01T12:00:00Z',
              closed_at: '2026-01-02T12:00:00Z',
              html_url: 'https://github.com/test-owner/test-repo/issues/1',
              author_association: 'MEMBER',
              user: { login: 'alice' },
            },
            {
              id: 102,
              number: 2,
              title: 'PR 2: Implement TypeScript config',
              body: 'Configures tsconfig.json and build step.',
              state: 'closed',
              created_at: '2026-01-03T12:00:00Z',
              closed_at: '2026-01-04T12:00:00Z',
              html_url: 'https://github.com/test-owner/test-repo/pull/2',
              author_association: 'CONTRIBUTOR',
              user: { login: 'bob' },
              pull_request: {
                url: 'https://api.github.com/repos/test-owner/test-repo/pulls/2',
                html_url: 'https://github.com/test-owner/test-repo/pull/2',
                merged_at: '2026-01-04T12:00:00Z',
              },
            },
          ]),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              etag: 'W/"issues-etag-1"',
            },
          },
        );
      }

      // Issue #1 comments
      if (url.includes('/issues/1/comments')) {
        return new Response(
          JSON.stringify([
            {
              id: 201,
              body: 'I agree. Flow is deprecated and TypeScript is standard.',
              created_at: '2026-01-01T13:00:00Z',
              html_url: 'https://github.com/test-owner/test-repo/issues/1#issuecomment-201',
              author_association: 'OWNER',
              user: { login: 'charlie' },
            },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      // Issue #2 comments
      if (url.includes('/issues/2/comments')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // PR #2 review comments
      if (url.includes('/pulls/2/comments')) {
        return new Response(
          JSON.stringify([
            {
              id: 301,
              body: 'Should we enable strictNullChecks in tsconfig?',
              created_at: '2026-01-03T13:00:00Z',
              html_url: 'https://github.com/test-owner/test-repo/pull/2#discussion_r301',
              author_association: 'MEMBER',
              user: { login: 'alice' },
            },
            {
              id: 302,
              in_reply_to_id: 301,
              body: 'Yes, strictNullChecks is required for the new pipeline.',
              created_at: '2026-01-03T14:00:00Z',
              html_url: 'https://github.com/test-owner/test-repo/pull/2#discussion_r302',
              author_association: 'OWNER',
              user: { login: 'charlie' },
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response('Not found', { status: 404 });
    }) as unknown as typeof fetch;

    const ingestService = new GitHubIngestService({
      db,
      fetchFn: mockFetch,
    });

    const job = jobManager.createJob('import_github', 'test-owner/test-repo');
    const result = await ingestService.ingestRepository(job.id, 'test-owner/test-repo', 10);

    expect(result.fullName).toBe('test-owner/test-repo');
    expect(result.sourcesCount).toBe(2);
    // 2 description comments + 1 issue comment + 2 review comments = 5 comments
    expect(result.commentsCount).toBe(5);

    // Verify Repository persistence
    const repoRow = db
      .prepare('SELECT * FROM repositories WHERE full_name = ?')
      .get('test-owner/test-repo') as { id: number; default_branch: string };
    expect(repoRow).toBeDefined();
    expect(repoRow.default_branch).toBe('main');

    // Verify Sources persistence
    const sources = db
      .prepare('SELECT * FROM sources WHERE repo_id = ? ORDER BY id ASC')
      .all(repoRow.id) as Array<{
      kind: string;
      external_id: string;
      state: string;
    }>;
    expect(sources).toHaveLength(2);
    expect(sources[0].kind).toBe('github_issue');
    expect(sources[0].external_id).toBe('test-owner/test-repo#1');
    expect(sources[0].state).toBe('closed');

    expect(sources[1].kind).toBe('github_pr');
    expect(sources[1].external_id).toBe('test-owner/test-repo#2');
    expect(sources[1].state).toBe('merged');

    // Verify Comments and FTS5 search
    const comments = db.prepare('SELECT * FROM comments').all() as Array<{
      body: string;
      body_norm: string;
      author_role: string;
    }>;
    expect(comments).toHaveLength(5);

    // Verify parent-child relationship on reply review comment
    const replyComment = db
      .prepare('SELECT id, parent_comment_id FROM comments WHERE external_id = ?')
      .get('rc-302') as { id: number; parent_comment_id: number | null };
    const parentComment = db
      .prepare('SELECT id FROM comments WHERE external_id = ?')
      .get('rc-301') as { id: number };

    expect(replyComment).toBeDefined();
    expect(parentComment).toBeDefined();
    expect(replyComment.parent_comment_id).toBe(parentComment.id);

    // FTS5 query should find comments mentioning TypeScript
    const ftsResults = db
      .prepare('SELECT rowid FROM comments_fts WHERE comments_fts MATCH ?')
      .all('TypeScript') as Array<{ rowid: number }>;
    expect(ftsResults.length).toBeGreaterThanOrEqual(1);

    // Verify Raw Responses caching
    const rawResponses = db.prepare('SELECT * FROM raw_responses').all();
    expect(rawResponses.length).toBeGreaterThan(0);
  });

  it('guarantees idempotency on repeated imports without duplicate records', async () => {
    const db = getDatabase();

    const mockFetch = vi.fn(async (urlStr: string | URL | Request) => {
      const url = urlStr.toString();
      if (url.includes('/issues?')) {
        return new Response(
          JSON.stringify([
            {
              id: 501,
              number: 1,
              title: 'Single Issue',
              body: 'Single Issue Body',
              state: 'open',
              created_at: '2026-02-01T00:00:00Z',
              closed_at: null,
              html_url: 'https://github.com/idempotent/repo/issues/1',
              author_association: 'NONE',
              user: { login: 'dev' },
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/comments')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/repos/idempotent/repo')) {
        return new Response(
          JSON.stringify({
            id: 999,
            full_name: 'idempotent/repo',
            default_branch: 'main',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const ingestService = new GitHubIngestService({ db, fetchFn: mockFetch });

    // Run import first time
    const job1 = jobManager.createJob('import_github', 'idempotent/repo');
    await ingestService.ingestRepository(job1.id, 'idempotent/repo', 10);

    const repoCount1 = db.prepare('SELECT count(*) as c FROM repositories').get() as { c: number };
    const sourcesCount1 = db.prepare('SELECT count(*) as c FROM sources').get() as { c: number };
    const commentsCount1 = db.prepare('SELECT count(*) as c FROM comments').get() as { c: number };

    expect(repoCount1.c).toBe(1);
    expect(sourcesCount1.c).toBe(1);
    expect(commentsCount1.c).toBe(1);

    // Run import second time (re-import)
    const job2 = jobManager.createJob('import_github', 'idempotent/repo');
    await ingestService.ingestRepository(job2.id, 'idempotent/repo', 10);

    const repoCount2 = db.prepare('SELECT count(*) as c FROM repositories').get() as { c: number };
    const sourcesCount2 = db.prepare('SELECT count(*) as c FROM sources').get() as { c: number };
    const commentsCount2 = db.prepare('SELECT count(*) as c FROM comments').get() as { c: number };

    // Row counts must not duplicate
    expect(repoCount2.c).toBe(1);
    expect(sourcesCount2.c).toBe(1);
    expect(commentsCount2.c).toBe(1);
  });

  it('handles rate limits (403/429) gracefully with descriptive errors', async () => {
    const db = getDatabase();

    const mockFetch = vi.fn(async () => {
      return new Response('Rate limited', {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1800000000',
        },
      });
    }) as unknown as typeof fetch;

    const ingestService = new GitHubIngestService({ db, fetchFn: mockFetch });
    const job = jobManager.createJob('import_github', 'rate/limited');

    await expect(ingestService.ingestRepository(job.id, 'rate/limited')).rejects.toThrowError(
      /rate limit/i,
    );

    const failedJob = jobManager.getJob(job.id);
    expect(failedJob?.status).toBe('failed');
    expect(failedJob?.error).toContain('rate limit');
  });

  it('handles 404 repository not found with useful error', async () => {
    const db = getDatabase();

    const mockFetch = vi.fn(async () => {
      return new Response('Not found', { status: 404 });
    }) as unknown as typeof fetch;

    const ingestService = new GitHubIngestService({ db, fetchFn: mockFetch });
    const job = jobManager.createJob('import_github', 'nonexistent/repo');

    await expect(ingestService.ingestRepository(job.id, 'nonexistent/repo')).rejects.toThrowError(
      /not found/i,
    );
  });

  it('handles 304 Not Modified by using cached raw response body', async () => {
    const db = getDatabase();
    const url = 'https://api.github.com/repos/cached/repo';
    db.prepare(
      `INSERT INTO raw_responses (provider, request_key, http_status, etag, fetched_at, body)
       VALUES ('github', ?, 200, 'W/"test-etag"', '2026-01-01T00:00:00Z', ?)`,
    ).run(url, JSON.stringify({ full_name: 'cached/repo', default_branch: 'main' }));

    const mockFetch = vi.fn(async (_u, opts) => {
      expect(opts?.headers?.['If-None-Match']).toBe('W/"test-etag"');
      return new Response(null, { status: 304 });
    }) as unknown as typeof fetch;

    const ingestService = new GitHubIngestService({
      db,
      fetchFn: mockFetch,
      token: 'ghp_dummytoken123',
    });

    const result = await ingestService.fetchGitHubApi<{ full_name: string }>('/repos/cached/repo');
    expect(result.data.full_name).toBe('cached/repo');
  });

  it('retries on 500 server error and succeeds on subsequent attempt', async () => {
    const db = getDatabase();
    let attempts = 0;
    const mockFetch = vi.fn(async () => {
      attempts++;
      if (attempts === 1) {
        return new Response('Internal Server Error', { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const ingestService = new GitHubIngestService({ db, fetchFn: mockFetch });
    const res = await ingestService.fetchGitHubApi<{ ok: boolean }>('/test-500');
    expect(res.data.ok).toBe(true);
    expect(attempts).toBe(2);
  });

  it('exhausts retries and throws on persistent network error', async () => {
    const db = getDatabase();
    const mockFetch = vi.fn(async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;

    const ingestService = new GitHubIngestService({ db, fetchFn: mockFetch });
    await expect(ingestService.fetchGitHubApi('/test-network', 1)).rejects.toThrowError(
      /network error contacting github api/i,
    );
  });

  it('rejects redirects pointing to external or untrusted hosts (SSRF defense)', async () => {
    const db = getDatabase();
    const mockFetch = vi.fn(async () => {
      return new Response(null, {
        status: 302,
        headers: { location: 'https://evil.com/malicious-redirect' },
      });
    }) as unknown as typeof fetch;

    const ingestService = new GitHubIngestService({ db, fetchFn: mockFetch });
    await expect(ingestService.fetchGitHubApi('/redirect-test')).rejects.toThrowError(
      /untrusted destination/i,
    );
  });

  it('paginates comments across multiple pages up to the page boundary', async () => {
    const db = getDatabase();
    const mockFetch = vi.fn(async (urlStr: string | URL | Request) => {
      const url = urlStr.toString();
      if (url.includes('/repos/paginated/repo') && !url.includes('/issues')) {
        return new Response(
          JSON.stringify({
            id: 888,
            full_name: 'paginated/repo',
            default_branch: 'main',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/issues?')) {
        return new Response(
          JSON.stringify([
            {
              id: 701,
              number: 1,
              title: 'Multi-page Issue',
              body: 'Discussion with lots of comments',
              state: 'open',
              created_at: '2026-03-01T00:00:00Z',
              closed_at: null,
              html_url: 'https://github.com/paginated/repo/issues/1',
              author_association: 'MEMBER',
              user: { login: 'reviewer' },
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/issues/1/comments')) {
        const parsedUrl = new URL(url);
        const pageNum = parsedUrl.searchParams.get('page');
        if (pageNum === '1') {
          // Return 100 comments on page 1 to trigger page 2
          const page1 = Array.from({ length: 100 }, (_, i) => ({
            id: 1000 + i,
            body: `Comment ${i + 1}`,
            created_at: '2026-03-01T01:00:00Z',
            html_url: `https://github.com/paginated/repo/issues/1#c${1000 + i}`,
            author_association: 'CONTRIBUTOR',
            user: { login: `user${i}` },
          }));
          return new Response(JSON.stringify(page1), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (pageNum === '2') {
          // Return 5 comments on page 2 (terminating condition)
          const page2 = Array.from({ length: 5 }, (_, i) => ({
            id: 2000 + i,
            body: `Page 2 Comment ${i + 1}`,
            created_at: '2026-03-01T02:00:00Z',
            html_url: `https://github.com/paginated/repo/issues/1#c${2000 + i}`,
            author_association: 'CONTRIBUTOR',
            user: { login: `user_p2_${i}` },
          }));
          return new Response(JSON.stringify(page2), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const ingestService = new GitHubIngestService({ db, fetchFn: mockFetch });
    const job = jobManager.createJob('import_github', 'paginated/repo');
    const result = await ingestService.ingestRepository(job.id, 'paginated/repo', 10);

    expect(result.sourcesCount).toBe(1);
    // 1 description comment + 100 page-1 comments + 5 page-2 comments = 106 comments
    expect(result.commentsCount).toBe(106);

    const commentCount = db.prepare('SELECT count(*) as c FROM comments').get() as { c: number };
    expect(commentCount.c).toBe(106);
  });
});
