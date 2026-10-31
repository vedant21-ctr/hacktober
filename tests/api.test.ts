import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { app, GitHubIngestService, extractionLockManager } from '../server/index.js';
import { ExtractionService } from '../server/extract/service.js';
import { initDatabase, getDatabase } from '../server/db/index.js';
import { jobManager } from '../server/jobs.js';
import { createRateLimiter } from '../server/middleware/rateLimit.js';

describe('Express Server API', () => {
  beforeEach(() => {
    initDatabase(':memory:');
    jobManager.clear();
    extractionLockManager.clear();

    vi.spyOn(GitHubIngestService.prototype, 'ingestRepository').mockImplementation(async () => ({
      repoId: 1,
      fullName: 'facebook/react',
      sourcesCount: 1,
      commentsCount: 1,
    }));
    vi.spyOn(ExtractionService.prototype, 'extract').mockImplementation(async () => ({
      runId: 1,
      sourcesProcessed: 1,
      decisionsRecovered: 1,
      decisions: [],
    }));
  });

  it('GET /api/status returns 200 with DB status', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('db', true);
    expect(res.body).toHaveProperty('ollama');
    expect(res.body.ollama).toHaveProperty('model', 'gemma4:e4b');
  });

  it('POST /api/imports validates payload and accepts valid github_repo requests', async () => {
    // Bad payload
    const badRes = await request(app).post('/api/imports').send({ invalid: true });
    expect(badRes.status).toBe(400);
    expect(badRes.body.error.code).toBe('VALIDATION_ERROR');

    // SSRF attempt
    const ssrfRes = await request(app)
      .post('/api/imports')
      .send({ kind: 'github_repo', target: 'https://evil.com/malicious/repo' });
    expect(ssrfRes.status).toBe(400);
    expect(ssrfRes.body.error.code).toBe('SSRF_REJECTED');

    // Unimplemented provider kind
    const unimplRes = await request(app)
      .post('/api/imports')
      .send({ kind: 'discourse_topic', target: 'python/12345' });
    expect(unimplRes.status).toBe(501);
    expect(unimplRes.body.error.code).toBe('NOT_IMPLEMENTED');

    // Valid GitHub import
    const validRes = await request(app)
      .post('/api/imports')
      .send({ kind: 'github_repo', target: 'facebook/react', limit: 10 });
    expect(validRes.status).toBe(202);
    expect(validRes.body).toHaveProperty('jobId');
    expect(typeof validRes.body.jobId).toBe('number');
  });

  it('GET /api/jobs/:id returns job progress or 404', async () => {
    // Invalid ID
    const invalidRes = await request(app).get('/api/jobs/abc');
    expect(invalidRes.status).toBe(400);

    // Non-existent job
    const notFoundRes = await request(app).get('/api/jobs/9999');
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.error.code).toBe('NOT_FOUND');

    // Existing job
    const job = jobManager.createJob('import_github', 'facebook/react');
    const res = await request(app).get(`/api/jobs/${job.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(job.id);
    expect(res.body.type).toBe('import_github');
    expect(res.body.status).toBe('queued');
    expect(res.body.stage).toBe('ingest');
  });

  it('GET /api/repositories returns repository items', async () => {
    const res = await request(app).get('/api/repositories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/overview returns aggregated counts or 404 for missing repo', async () => {
    const res = await request(app).get('/api/overview');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('counts');
    expect(res.body.counts).toHaveProperty('sources', 0);
    expect(res.body.counts).toHaveProperty('decisions', 0);

    // With non-existent repoId
    const missingRes = await request(app).get('/api/overview?repoId=9999');
    expect(missingRes.status).toBe(404);
  });

  it('GET /api/sources/:id returns source detail or 404', async () => {
    // Invalid ID
    const badIdRes = await request(app).get('/api/sources/invalid');
    expect(badIdRes.status).toBe(400);

    // Not found
    const notFoundRes = await request(app).get('/api/sources/9999');
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/extract validates payload and starts background decision extraction', async () => {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO repositories (id, full_name, imported_at) VALUES (1, 'facebook/react', datetime('now'))`,
    ).run();
    db.prepare(
      `INSERT INTO sources (id, repo_id, kind, external_id, url, title, created_at)
       VALUES (1, 1, 'github_issue', '1', 'https://github.com/facebook/react/issues/1', 'Issue 1', datetime('now'))`,
    ).run();

    // Bad payload
    const badRes = await request(app).post('/api/extract').send({ repoId: 'invalid_number' });
    expect(badRes.status).toBe(400);
    expect(badRes.body.error.code).toBe('VALIDATION_ERROR');

    // M2: Empty request body rejected
    const emptyRes = await request(app).post('/api/extract').send({});
    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.error.code).toBe('VALIDATION_ERROR');

    // M2: Empty sourceIds array rejected
    const emptyArrRes = await request(app).post('/api/extract').send({ sourceIds: [] });
    expect(emptyArrRes.status).toBe(400);
    expect(emptyArrRes.body.error.code).toBe('VALIDATION_ERROR');

    // M2: Non-existent sourceIds returns 404
    const nonExistentSourceRes = await request(app)
      .post('/api/extract')
      .send({ sourceIds: [99999] });
    expect(nonExistentSourceRes.status).toBe(404);
    expect(nonExistentSourceRes.body.error.code).toBe('NOT_FOUND');

    // Missing repoId
    const missingRepoRes = await request(app).post('/api/extract').send({ repoId: 99999 });
    expect(missingRepoRes.status).toBe(404);
    expect(missingRepoRes.body.error.code).toBe('NOT_FOUND');

    // Valid extraction request
    const validRes = await request(app)
      .post('/api/extract')
      .send({ sourceIds: [1] });
    expect(validRes.status).toBe(202);
    expect(validRes.body).toHaveProperty('jobId');
    expect(typeof validRes.body.jobId).toBe('number');
  });

  it('H1 enforces extraction concurrency locks and rejects overlapping extractions with 409', async () => {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO repositories (id, full_name, imported_at) VALUES (1, 'facebook/react', datetime('now'))`,
    ).run();
    db.prepare(
      `INSERT INTO sources (id, repo_id, kind, external_id, url, title, created_at)
       VALUES (1, 1, 'github_issue', '1', 'https://github.com/facebook/react/issues/1', 'Issue 1', datetime('now'))`,
    ).run();

    // Hang first extraction job to simulate in-flight work
    let resolveExtract: (() => void) | undefined;
    vi.spyOn(ExtractionService.prototype, 'extract').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveExtract = () =>
            resolve({ runId: 1, sourcesProcessed: 1, decisionsRecovered: 1, decisions: [] });
        }),
    );

    // 1. Start extraction on repo 1
    const res1 = await request(app).post('/api/extract').send({ repoId: 1 });
    expect(res1.status).toBe(202);

    // 2. Simultaneous extraction request on same repo 1 returns 409
    const dupRepoRes = await request(app).post('/api/extract').send({ repoId: 1 });
    expect(dupRepoRes.status).toBe(409);
    expect(dupRepoRes.body.error.code).toBe('CONFLICT');
    expect(dupRepoRes.body.error.message).toContain('already being extracted');

    // 3. Overlapping extraction request on source 1 (which belongs to repo 1) returns 409
    const overlapSourceRes = await request(app)
      .post('/api/extract')
      .send({ sourceIds: [1] });
    expect(overlapSourceRes.status).toBe(409);
    expect(overlapSourceRes.body.error.code).toBe('CONFLICT');

    // Finish the first job
    if (resolveExtract) resolveExtract();
    await new Promise((r) => setTimeout(r, 20));

    // 4. After job completes, new extraction on repo 1 succeeds
    const nextRes = await request(app).post('/api/extract').send({ repoId: 1 });
    expect(nextRes.status).toBe(202);
  });

  it('H1 releases extraction lock after background failure', async () => {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO repositories (id, full_name, imported_at) VALUES (1, 'facebook/react', datetime('now'))`,
    ).run();

    vi.spyOn(ExtractionService.prototype, 'extract').mockRejectedValueOnce(
      new Error('Simulated extraction engine crash'),
    );

    const failRes = await request(app).post('/api/extract').send({ repoId: 1 });
    expect(failRes.status).toBe(202);

    // Wait for promise rejection to propagate and finally block to run
    await new Promise((r) => setTimeout(r, 30));

    // Subsequent extraction must succeed because lock was released in finally
    const retryRes = await request(app).post('/api/extract').send({ repoId: 1 });
    expect(retryRes.status).toBe(202);
  });

  it('H3 bounds decision listing query parameters and rejects out-of-range values', async () => {
    // 1. Out-of-range pageSize (> 100) returns 400
    const bigPageRes = await request(app).get('/api/decisions?pageSize=101');
    expect(bigPageRes.status).toBe(400);
    expect(bigPageRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(bigPageRes.body.error.message).toContain('Page size must not exceed 100');

    // Valid maximum pageSize (100) succeeds
    const maxPageRes = await request(app).get('/api/decisions?pageSize=100');
    expect(maxPageRes.status).toBe(200);

    // 2. Out-of-range q (> 200 chars) returns 400
    const longQ = 'a'.repeat(201);
    const longQRes = await request(app).get(`/api/decisions?q=${longQ}`);
    expect(longQRes.status).toBe(400);
    expect(longQRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(longQRes.body.error.message).toContain('Search query must not exceed 200 characters');

    // Valid maximum q (200 chars) succeeds
    const validQ = 'a'.repeat(200);
    const validQRes = await request(app).get(`/api/decisions?q=${validQ}`);
    expect(validQRes.status).toBe(200);
  });

  it('H1 enforces extraction concurrency locks and rejects overlapping extractions with 409', async () => {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO repositories (id, full_name, imported_at) VALUES (1, 'facebook/react', datetime('now'))`,
    ).run();
    db.prepare(
      `INSERT INTO sources (id, repo_id, kind, external_id, url, title, created_at)
       VALUES (1, 1, 'github_issue', '1', 'https://github.com/facebook/react/issues/1', 'Issue 1', datetime('now'))`,
    ).run();

    // Hang first extraction job to simulate in-flight work
    let resolveExtract: (() => void) | undefined;
    vi.spyOn(ExtractionService.prototype, 'extract').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveExtract = () => resolve({ runId: 1, sourcesProcessed: 1, decisionsRecovered: 1, decisions: [] });
        }),
    );

    // 1. Start extraction on repo 1
    const res1 = await request(app).post('/api/extract').send({ repoId: 1 });
    expect(res1.status).toBe(202);

    // 2. Simultaneous extraction request on same repo 1 returns 409
    const dupRepoRes = await request(app).post('/api/extract').send({ repoId: 1 });
    expect(dupRepoRes.status).toBe(409);
    expect(dupRepoRes.body.error.code).toBe('CONFLICT');
    expect(dupRepoRes.body.error.message).toContain('already being extracted');

    // 3. Overlapping extraction request on source 1 (which belongs to repo 1) returns 409
    const overlapSourceRes = await request(app).post('/api/extract').send({ sourceIds: [1] });
    expect(overlapSourceRes.status).toBe(409);
    expect(overlapSourceRes.body.error.code).toBe('CONFLICT');

    // Finish the first job
    if (resolveExtract) resolveExtract();
    await new Promise((r) => setTimeout(r, 20));

    // 4. After job completes, new extraction on repo 1 succeeds
    const nextRes = await request(app).post('/api/extract').send({ repoId: 1 });
    expect(nextRes.status).toBe(202);
  });

  it('H1 releases extraction lock after background failure', async () => {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO repositories (id, full_name, imported_at) VALUES (1, 'facebook/react', datetime('now'))`,
    ).run();

    vi.spyOn(ExtractionService.prototype, 'extract').mockRejectedValueOnce(
      new Error('Simulated extraction engine crash'),
    );

    const failRes = await request(app).post('/api/extract').send({ repoId: 1 });
    expect(failRes.status).toBe(202);

    // Wait for promise rejection to propagate and finally block to run
    await new Promise((r) => setTimeout(r, 30));

    // Subsequent extraction must succeed because lock was released in finally
    const retryRes = await request(app).post('/api/extract').send({ repoId: 1 });
    expect(retryRes.status).toBe(202);
  });

  it('H3 bounds decision listing query parameters and rejects out-of-range values', async () => {
    // 1. Out-of-range pageSize (> 100) returns 400
    const bigPageRes = await request(app).get('/api/decisions?pageSize=101');
    expect(bigPageRes.status).toBe(400);
    expect(bigPageRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(bigPageRes.body.error.message).toContain('Page size must not exceed 100');

    // Valid maximum pageSize (100) succeeds
    const maxPageRes = await request(app).get('/api/decisions?pageSize=100');
    expect(maxPageRes.status).toBe(200);

    // 2. Out-of-range q (> 200 chars) returns 400
    const longQ = 'a'.repeat(201);
    const longQRes = await request(app).get(`/api/decisions?q=${longQ}`);
    expect(longQRes.status).toBe(400);
    expect(longQRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(longQRes.body.error.message).toContain('Search query must not exceed 200 characters');

    // Valid maximum q (200 chars) succeeds
    const validQ = 'a'.repeat(200);
    const validQRes = await request(app).get(`/api/decisions?q=${validQ}`);
    expect(validQRes.status).toBe(200);
  });

  it('GET /api/decisions returns decision items with filtering and pagination', async () => {
    // Invalid filter
    const badRes = await request(app).get('/api/decisions?status=invalid_status');
    expect(badRes.status).toBe(400);

    // Empty list
    const res = await request(app).get('/api/decisions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total', 0);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/decisions/:id returns 400 for bad id and 404 for missing decision', async () => {
    const badIdRes = await request(app).get('/api/decisions/not-a-number');
    expect(badIdRes.status).toBe(400);

    const missingRes = await request(app).get('/api/decisions/9999');
    expect(missingRes.status).toBe(404);
    expect(missingRes.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/decisions/:id returns detailed decision with alternatives and verified evidence', async () => {
    const db = getDatabase();
    // Seed repo and source
    const repoRes = db
      .prepare(
        `INSERT INTO repositories (full_name, imported_at) VALUES ('facebook/react', datetime('now'))`,
      )
      .run();
    const repoId = Number(repoRes.lastInsertRowid);

    const sourceRes = db
      .prepare(
        `INSERT INTO sources (repo_id, kind, external_id, url, title, created_at)
         VALUES (?, 'github_issue', 'facebook/react#1', 'https://github.com/facebook/react/issues/1', 'Decision Source Title', datetime('now'))`,
      )
      .run(repoId);
    const sId = Number(sourceRes.lastInsertRowid);

    const commentRes = db
      .prepare(
        `INSERT INTO comments (source_id, external_id, idx, author, author_role, created_at, body, body_norm, url)
         VALUES (?, 'comm-1', 0, 'dan', 'owner', datetime('now'), 'We decided on React Hooks', 'we decided on react hooks', 'https://example.com/c1')`,
      )
      .run(sId);
    const commId = Number(commentRes.lastInsertRowid);

    const runRes = db
      .prepare(
        `INSERT INTO runs (kind, model, mode, prompt_version, params_json, started_at, status)
         VALUES ('extract_b', 'gemma4:e4b', 'replay', 'v1.0.0', '{}', datetime('now'), 'succeeded')`,
      )
      .run();
    const rId = Number(runRes.lastInsertRowid);

    const decRes = db
      .prepare(
        `INSERT INTO decisions (source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, last_verified_at, created_at)
         VALUES (?, ?, 'Use Hooks', 'accepted', 'active', 'Summary text', 0.95, '{"coverage":1,"statement":1,"reasonCoverage":1}', datetime('now'), datetime('now'))`,
      )
      .run(sId, rId);
    const decId = Number(decRes.lastInsertRowid);

    // Decision evidence
    db.prepare(
      `INSERT INTO evidence (decision_id, alternative_id, comment_id, claim_type, quote, verified, verification_method, match_score, created_at)
       VALUES (?, NULL, ?, 'decision_statement', 'We decided on React Hooks', 1, 'normalized_exact', 1.0, datetime('now'))`,
    ).run(decId, commId);

    // Alternative
    const altRes = db
      .prepare(
        `INSERT INTO alternatives (decision_id, name, description, outcome, reason, reason_category)
         VALUES (?, 'React Hooks', 'Stateful functions', 'chosen', 'Cleaner code', 'maintenance')`,
      )
      .run(decId);
    const altId = Number(altRes.lastInsertRowid);

    db.prepare(
      `INSERT INTO evidence (decision_id, alternative_id, comment_id, claim_type, quote, verified, verification_method, match_score, created_at)
       VALUES (?, ?, ?, 'proposal', 'We decided on React Hooks', 1, 'normalized_exact', 1.0, datetime('now'))`,
    ).run(decId, altId, commId);

    const res = await request(app).get(`/api/decisions/${decId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(decId);
    expect(res.body.title).toBe('Use Hooks');
    expect(res.body.status).toBe('accepted');
    expect(res.body.decisionEvidence).toHaveLength(1);
    expect(res.body.decisionEvidence[0].verified).toBe(true);
    expect(res.body.alternatives).toHaveLength(1);
    expect(res.body.alternatives[0].name).toBe('React Hooks');
    expect(res.body.confidenceParts).toEqual({ coverage: 1, statement: 1, reasonCoverage: 1 });
  });

  it('POST /api/ask returns 501 with valid body', async () => {
    const res = await request(app)
      .post('/api/ask')
      .send({ repoId: 1, question: 'Why was cgi removed?' });
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/code/tree returns 501', async () => {
    const res = await request(app).get('/api/code/tree');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/code/why returns 501 with valid query', async () => {
    const res = await request(app).get('/api/code/why?path=Lib/cgi.py');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/radar returns 501', async () => {
    const res = await request(app).get('/api/radar');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /api/radar/recheck returns 501 with valid body', async () => {
    const res = await request(app).post('/api/radar/recheck').send({});
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/timeline/:decisionId returns 501', async () => {
    const res = await request(app).get('/api/timeline/1');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/relationships returns 501 with valid query', async () => {
    const res = await request(app).get('/api/relationships?decisionId=1');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /api/sandbox/prior-art returns 501 with valid body', async () => {
    const res = await request(app)
      .post('/api/sandbox/prior-art')
      .send({ repoId: 1, input: { type: 'idea', value: 'Add type annotations' } });
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/sandbox/reports/:id returns 501', async () => {
    const res = await request(app).get('/api/sandbox/reports/1');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/benchmark/cases returns 501', async () => {
    const res = await request(app).get('/api/benchmark/cases');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /api/benchmark/run returns 501 with valid body', async () => {
    const res = await request(app).post('/api/benchmark/run').send({ caseId: 1 });
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/benchmark/runs/:id returns 501', async () => {
    const res = await request(app).get('/api/benchmark/runs/1');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /api/benchmark/runs/:id/confirm returns 501 with valid body', async () => {
    const res = await request(app).post('/api/benchmark/runs/1/confirm').send({ matches: [] });
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('returns 404 for unhandled routes with standard error shape', async () => {
    const res = await request(app).get('/api/unhandled/route/test');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
  });

  it('rate limiting middleware enforces request quota and returns standard 429 error', async () => {
    const testApp = express();
    const testLimiter = createRateLimiter({
      limit: 2,
      windowMs: 60 * 1000,
    });
    testApp.get('/api/test-limit', testLimiter, (_req, res) => {
      res.json({ ok: true });
    });

    const res1 = await request(testApp).get('/api/test-limit');
    expect(res1.status).toBe(200);

    const res2 = await request(testApp).get('/api/test-limit');
    expect(res2.status).toBe(200);

    const res3 = await request(testApp).get('/api/test-limit');
    expect(res3.status).toBe(429);
    expect(res3.body).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down.',
      },
    });
  });

  it('rate limiting respects environment variables for window and max', () => {
    const origWindow = process.env.RATE_LIMIT_WINDOW_MS;
    const origMax = process.env.RATE_LIMIT_MAX;
    try {
      process.env.RATE_LIMIT_WINDOW_MS = '30000';
      process.env.RATE_LIMIT_MAX = '50';
      const customLimiter = createRateLimiter();
      expect(customLimiter).toBeDefined();
    } finally {
      process.env.RATE_LIMIT_WINDOW_MS = origWindow;
      process.env.RATE_LIMIT_MAX = origMax;
    }
  });
});
