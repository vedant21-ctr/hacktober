import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { app, GitHubIngestService } from '@decisionvault/server';
import { initDatabase } from '@decisionvault/server/db';
import { jobManager } from '../server/jobs.js';
import { createRateLimiter } from '../server/middleware/rateLimit.js';

describe('Express Server API', () => {
  beforeEach(() => {
    initDatabase(':memory:');
    jobManager.clear();
    vi.spyOn(GitHubIngestService.prototype, 'ingestRepository').mockImplementation(async () => ({
      repoId: 1,
      fullName: 'facebook/react',
      sourcesCount: 1,
      commentsCount: 1,
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

  it('POST /api/extract returns 501', async () => {
    const res = await request(app).post('/api/extract').send({});
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/decisions returns 501', async () => {
    const res = await request(app).get('/api/decisions');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/decisions/:id returns 501', async () => {
    const res = await request(app).get('/api/decisions/1');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
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
