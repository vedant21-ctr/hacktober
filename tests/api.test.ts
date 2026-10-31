import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '@decisionvault/server';

describe('Express Server API', () => {
  it('GET /api/status returns 200 with DB status', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('db', true);
    expect(res.body).toHaveProperty('ollama');
    expect(res.body.ollama).toHaveProperty('model', 'gemma4:e4b');
  });

  it('POST /api/imports validates payload and returns 501 for valid body', async () => {
    // Bad payload
    const badRes = await request(app).post('/api/imports').send({ invalid: true });
    expect(badRes.status).toBe(400);
    expect(badRes.body.error.code).toBe('VALIDATION_ERROR');

    // Valid payload
    const res = await request(app)
      .post('/api/imports')
      .send({ kind: 'github_repo', target: 'python/cpython' });
    expect(res.status).toBe(501);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This endpoint has not been implemented yet.',
      },
    });
  });

  it('POST /api/extract returns 501', async () => {
    const res = await request(app).post('/api/extract').send({});
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/jobs/:id returns 501', async () => {
    const res = await request(app).get('/api/jobs/1');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/repositories returns 501', async () => {
    const res = await request(app).get('/api/repositories');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/overview returns 501', async () => {
    const res = await request(app).get('/api/overview');
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

  it('GET /api/sources/:id returns 501', async () => {
    const res = await request(app).get('/api/sources/1');
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

  it('POST /api/radar/recheck returns 501', async () => {
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
      .send({ repoId: 1, input: { type: 'idea', value: 'keep cgi' } });
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
    const res = await request(app)
      .post('/api/benchmark/runs/1/confirm')
      .send({
        matches: [{ goldId: 1, alternativeId: 1, confirmed: true, reasonGrade: 1.0 }],
      });
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('returns 404 for unhandled routes with standard error shape', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
  });
});
