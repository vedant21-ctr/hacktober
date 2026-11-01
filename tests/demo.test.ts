import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../server/index.js';
import { initDatabase, getDatabase } from '../server/db/index.js';
import { demoService } from '../server/demo/service.js';
import { priorArtService } from '../server/sandbox/service.js';
import { normalizeText } from '@decisionvault/shared';
import {
  DemoStatusResponseSchema,
  DemoSeedResponseSchema,
  DemoResetResponseSchema,
} from '@decisionvault/shared/api';

describe('DecisionVault Fictional Demo Repository (acme-inc/payment-service)', () => {
  beforeEach(() => {
    initDatabase(':memory:');
  });

  describe('DemoService Seeding & Data Integrity', () => {
    it('reports unseeded status initially', () => {
      const status = demoService.getDemoStatus();
      expect(status.seeded).toBe(false);
      expect(status.repoId).toBeNull();
      expect(status.repoName).toBe('acme-inc/payment-service');
      expect(status.sourcesCount).toBe(0);
      expect(status.decisionsCount).toBe(0);
      expect(() => DemoStatusResponseSchema.parse(status)).not.toThrow();
    });

    it('seeds fictional demo repository with 5 sources, 5 decisions, and verified evidence', () => {
      const result = demoService.seedDemoRepository();
      expect(result.ok).toBe(true);
      expect(result.repoName).toBe('acme-inc/payment-service');
      expect(result.sourcesCount).toBe(5);
      expect(result.decisionsCount).toBe(5);
      expect(() => DemoSeedResponseSchema.parse(result)).not.toThrow();

      const db = getDatabase();

      // Check repository entry
      const repo = db
        .prepare('SELECT id, full_name, default_branch FROM repositories WHERE id = ?')
        .get(result.repoId) as { id: number; full_name: string; default_branch: string };
      expect(repo).toBeDefined();
      expect(repo.full_name).toBe('acme-inc/payment-service');
      expect(repo.default_branch).toBe('main');

      // Check decisions
      const decisions = db
        .prepare(
          'SELECT id, title, confidence FROM decisions WHERE source_id IN (SELECT id FROM sources WHERE repo_id = ?)',
        )
        .all(result.repoId) as Array<{ id: number; title: string; confidence: number }>;
      expect(decisions).toHaveLength(5);

      const titles = decisions.map((d) => d.title);
      expect(titles).toContain('PostgreSQL for ACID Transaction Isolation');
      expect(titles).toContain('Asynchronous Queue-Backed Payment Processing');
      expect(titles).toContain('Zero Raw Card Data Storage (Tokenization via Vault)');
      expect(titles).toContain('Mandatory Idempotency-Key Header on Charge Mutations');
      expect(titles).toContain('Exponential Backoff with Full Jitter and Circuit Breaker');

      // Check alternatives
      const alternatives = db
        .prepare('SELECT id, name, outcome, reason FROM alternatives')
        .all() as Array<{ id: number; name: string; outcome: string; reason: string }>;
      expect(alternatives.length).toBeGreaterThanOrEqual(10);
      const rejectedAlts = alternatives.filter((a) => a.outcome === 'rejected');
      expect(rejectedAlts.length).toBeGreaterThanOrEqual(5);

      // Check decision_files
      const files = db.prepare('SELECT DISTINCT path FROM decision_files').all() as Array<{
        path: string;
      }>;
      const filePaths = files.map((f) => f.path);
      expect(filePaths).toContain('src/db/schema.sql');
      expect(filePaths).toContain('src/services/payment.ts');
      expect(filePaths).toContain('src/models/card.ts');
      expect(filePaths).toContain('src/middleware/idempotency.ts');
      expect(filePaths).toContain('src/services/retry.ts');
    });

    it('seeding is idempotent: multiple calls do not duplicate records', () => {
      const first = demoService.seedDemoRepository();
      const second = demoService.seedDemoRepository();

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      expect(first.repoId).toBe(second.repoId);

      const db = getDatabase();
      const repoCount = (
        db
          .prepare('SELECT COUNT(*) as count FROM repositories WHERE full_name = ?')
          .get('acme-inc/payment-service') as { count: number }
      ).count;
      expect(repoCount).toBe(1);

      const decCount = (
        db
          .prepare(
            'SELECT COUNT(*) as count FROM decisions WHERE source_id IN (SELECT id FROM sources WHERE repo_id = ?)',
          )
          .get(first.repoId) as { count: number }
      ).count;
      expect(decCount).toBe(5);
    });

    it('anchors every evidence quote with exact character offsets in comments.body_norm', () => {
      const seedRes = demoService.seedDemoRepository();
      const db = getDatabase();

      const evidenceRows = db
        .prepare(
          `SELECT e.id, e.quote, e.verified, e.verification_method, e.match_score,
                  e.match_start, e.match_end,
                  c.body_norm
           FROM evidence e
           JOIN comments c ON e.comment_id = c.id
           JOIN decisions d ON e.decision_id = d.id
           JOIN sources s ON d.source_id = s.id
           WHERE s.repo_id = ?`,
        )
        .all(seedRes.repoId) as Array<{
        id: number;
        quote: string;
        verified: number;
        verification_method: string;
        match_score: number;
        match_start: number | null;
        match_end: number | null;
        body_norm: string;
      }>;

      expect(evidenceRows.length).toBeGreaterThanOrEqual(5);

      for (const ev of evidenceRows) {
        expect(ev.verified).toBe(1);
        expect(ev.verification_method).toBe('normalized_exact');
        expect(ev.match_score).toBe(1.0);
        expect(ev.match_start).not.toBeNull();
        expect(ev.match_end).not.toBeNull();

        const quoteNorm = normalizeText(ev.quote);
        const slice = ev.body_norm.slice(ev.match_start!, ev.match_end!);
        expect(slice).toBe(quoteNorm);
      }
    });
  });

  describe('Prior Art Conflict Detection Scenario', () => {
    it('detects earlier rejection of synchronous payment processing and flags conflict', async () => {
      const seedRes = demoService.seedDemoRepository();
      const db = getDatabase();

      // Developer proposes synchronous payment processing
      const proposal =
        'Proposal: We should replace asynchronous payment processing with synchronous HTTP gateway calls in src/services/payment.ts to simplify our code.';

      const report = await priorArtService.runPriorArtAnalysis(
        seedRes.repoId,
        {
          type: 'idea',
          value: proposal,
        },
        1,
        db,
      );

      expect(report.items.length).toBeGreaterThan(0);

      // First matched item should be the conflict with Asynchronous Payment Processing
      const conflictItem = report.items.find(
        (item) => item.decision.title === 'Asynchronous Queue-Backed Payment Processing',
      );

      expect(conflictItem).toBeDefined();
      expect(conflictItem?.relation).toBe('conflicts');
      expect(conflictItem?.rejectedBecause).toContain(
        'Synchronous payment gateway calls cause thread exhaustion',
      );
      expect(conflictItem?.evidence.length).toBeGreaterThan(0);
      expect(conflictItem?.evidence[0].verified).toBe(true);
      expect(conflictItem?.evidence[0].quote).toContain(
        'Synchronous payment gateway calls cause thread exhaustion',
      );
    });
  });

  describe('Demo Reset & Repository Isolation', () => {
    it('safely deletes demo repository without affecting real repositories', () => {
      const db = getDatabase();

      // Seed a real repository
      db.prepare(
        `INSERT INTO repositories (id, full_name, default_branch, head_commit_sha, imported_at)
         VALUES (999, 'real-org/production-app', 'main', 'headsha', '2026-10-31T00:00:00Z')`,
      ).run();
      db.prepare(
        `INSERT INTO sources (id, repo_id, kind, external_id, url, title, state)
         VALUES (999, 999, 'github_issue', 'real-org#1', 'https://github.com/real-org/1', 'Real Issue', 'open')`,
      ).run();

      // Seed demo repository
      const seedRes = demoService.seedDemoRepository(db);
      expect(demoService.getDemoStatus(db).seeded).toBe(true);

      // Reset demo repository
      const resetRes = demoService.resetDemoRepository(db);
      expect(resetRes.ok).toBe(true);
      expect(resetRes.deleted).toBe(true);
      expect(() => DemoResetResponseSchema.parse(resetRes)).not.toThrow();

      // Confirm demo repository is gone
      const demoStatus = demoService.getDemoStatus(db);
      expect(demoStatus.seeded).toBe(false);

      // Confirm real repository is completely intact
      const realRepo = db
        .prepare('SELECT id, full_name FROM repositories WHERE id = 999')
        .get() as { id: number; full_name: string };
      expect(realRepo).toBeDefined();
      expect(realRepo.full_name).toBe('real-org/production-app');

      const realSource = db.prepare('SELECT id, title FROM sources WHERE repo_id = 999').get() as {
        id: number;
        title: string;
      };
      expect(realSource).toBeDefined();
      expect(realSource.title).toBe('Real Issue');
    });

    it('resetting when unseeded returns ok without errors', () => {
      const resetRes = demoService.resetDemoRepository();
      expect(resetRes.ok).toBe(true);
      expect(resetRes.deleted).toBe(false);
    });
  });

  describe('Demo HTTP API Endpoints', () => {
    it('GET /api/demo/status returns demo repository status', async () => {
      const res = await request(app).get('/api/demo/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('seeded');
      expect(res.body).toHaveProperty('repoName', 'acme-inc/payment-service');
      expect(() => DemoStatusResponseSchema.parse(res.body)).not.toThrow();
    });

    it('POST /api/demo/seed seeds demo data and returns 200', async () => {
      const res = await request(app).post('/api/demo/seed');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ok', true);
      expect(res.body).toHaveProperty('repoId');
      expect(res.body).toHaveProperty('sourcesCount', 5);
      expect(res.body).toHaveProperty('decisionsCount', 5);
      expect(() => DemoSeedResponseSchema.parse(res.body)).not.toThrow();
    });

    it('POST /api/demo/reset deletes demo repository and returns 200', async () => {
      await request(app).post('/api/demo/seed');
      const res = await request(app).post('/api/demo/reset');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ok', true);
      expect(res.body).toHaveProperty('deleted', true);
      expect(() => DemoResetResponseSchema.parse(res.body)).not.toThrow();
    });
  });
});
