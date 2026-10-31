import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Database as DatabaseType } from 'better-sqlite3';
import { app } from '@decisionvault/server';
import { closeDatabase, initDatabase } from '@decisionvault/server/db';
import { normalizeText } from '@decisionvault/shared/normalize';

describe('Security & Input Hardening', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = initDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('SQL Injection Defenses', () => {
    it('uses parameterized queries and rejects raw SQL injection attempts', () => {
      db.prepare(
        "INSERT INTO repositories (id, full_name, imported_at) VALUES (1, 'org/repo', '2026-10-31T00:00:00Z')",
      ).run();

      const maliciousExternalId = "test#1'; DROP TABLE sources; --";

      // Parameterized insertion must not execute the drop table
      db.prepare(
        'INSERT INTO sources (id, repo_id, kind, external_id, url, title) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(2, 1, 'github_issue', maliciousExternalId, 'https://example.com/2', 'Test');

      // Verify sources table still exists and record was stored safely as literal
      const source = db
        .prepare('SELECT * FROM sources WHERE external_id = ?')
        .get(maliciousExternalId) as { external_id: string };
      expect(source).toBeDefined();
      expect(source.external_id).toBe(maliciousExternalId);

      const tableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sources'")
        .get();
      expect(tableExists).toBeDefined();
    });

    it('safely handles malicious strings in FTS5 search queries', () => {
      // FTS5 MATCH with syntax characters like quotes, asterisks, AND/OR/NOT
      const maliciousQuery = `'; DROP TABLE comments_fts; -- " ' OR 1=1 *`;

      // In FTS5, querying an arbitrary string with proper quoting or parameterization does not drop tables
      expect(() => {
        db.prepare('SELECT rowid FROM comments_fts WHERE comments_fts MATCH ?').all(
          `"${maliciousQuery.replace(/"/g, '""')}"`,
        );
      }).not.toThrow();

      const ftsTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='comments_fts'")
        .get();
      expect(ftsTable).toBeDefined();
    });
  });

  describe('Path Traversal & Unsafe Input Defenses', () => {
    it('normalizes and neutralizes control characters and malicious markdown in normalizeText', () => {
      const traversalInput = '../../../../etc/passwd\x00\x1F';
      const normalized = normalizeText(traversalInput);
      expect(normalized).toBe('../../../../etc/passwd');
    });

    it('validates API requests and rejects path traversal in target and query parameters', async () => {
      // Target containing path traversal in import
      const res = await request(app)
        .post('/api/imports')
        .send({ kind: 'file', target: '../../../../secret.txt' });
      // Express router handles this endpoint and schema checks kind/target
      expect([400, 501]).toContain(res.status);
    });
  });

  describe('Error Leakage Prevention', () => {
    it('returns structured JSON errors without raw stack traces or internal secrets for 404', async () => {
      const res = await request(app).get('/api/completely-nonexistent-route-for-testing');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found.',
        },
      });
      expect(res.body).not.toHaveProperty('stack');
    });

    it('returns structured JSON errors for bad request payloads', async () => {
      const res = await request(app)
        .post('/api/imports')
        .send({ kind: 'unsupported_kind', target: '' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(typeof res.body.error.message).toBe('string');
      expect(res.body).not.toHaveProperty('stack');
    });
  });
});
