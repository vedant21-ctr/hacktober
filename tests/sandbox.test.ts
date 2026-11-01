import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PriorArtService, parsePriorArtInput } from '../server/sandbox/service.js';
import { PriorArtReportSchema } from '@decisionvault/shared/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../server/db/schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

describe('Prior-Art Detection Service (Phase 4)', () => {
  let db: Database.Database;
  let service: PriorArtService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(schemaSql);
    service = new PriorArtService();

    // Seed repository 1 (CPython)
    db.prepare(
      `INSERT INTO repositories (id, full_name, default_branch, head_commit_sha, imported_at)
       VALUES (1, 'python/cpython', 'main', 'cpythonHead', '2026-10-31T20:00:00.000Z')`,
    ).run();

    // Seed repository 2 (React)
    db.prepare(
      `INSERT INTO repositories (id, full_name, default_branch, head_commit_sha, imported_at)
       VALUES (2, 'facebook/react', 'main', 'reactHead', '2026-10-31T20:00:00.000Z')`,
    ).run();

    // Seed run
    db.prepare(
      `INSERT INTO runs (id, kind, model, mode, prompt_version, params_json, started_at, status)
       VALUES (1, 'extract_b', 'gemma4:e4b', 'replay', 'v1', '{}', '2026-10-31T20:00:00.000Z', 'succeeded')`,
    ).run();

    // Repo 1 Source (PEP 594 discussion)
    db.prepare(
      `INSERT INTO sources (id, repo_id, kind, external_id, url, title, state, base_commit_sha)
       VALUES (10, 1, 'discourse_topic', 'python/cpython#1932', 'https://discuss.python.org/t/pep-594/1932', 'PEP 594: Removing dead batteries', 'closed', NULL)`,
    ).run();

    // Repo 1 Comments
    db.prepare(
      `INSERT INTO comments (id, source_id, external_id, idx, author, author_role, created_at, body, body_norm, url)
       VALUES (101, 10, 'c1', 1, 'brettcannon', 'owner', '2019-05-20T14:32:00.000Z',
               'The cgi module has security liabilities and modern web frameworks have replaced it.',
               'the cgi module has security liabilities and modern web frameworks have replaced it.',
               'https://discuss.python.org/t/pep-594/1932/4')`,
    ).run();

    // Repo 1 Decision: Deprecate CGI (PEP 594)
    db.prepare(
      `INSERT INTO decisions (id, source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at)
       VALUES (12, 10, 1, 'Remove CGI and related dead-battery modules (PEP 594)', 'accepted', 'active',
               'Deprecate and remove cgi and other unmaintained standard library modules following PEP 594.',
               0.94, '{"coverage":1,"statement":1,"reasonCoverage":1}', '2019-05-20T14:35:00.000Z')`,
    ).run();

    // Repo 1 Evidence
    db.prepare(
      `INSERT INTO evidence (id, decision_id, alternative_id, comment_id, claim_type, quote, verified, verification_method, match_score, created_at)
       VALUES (501, 12, NULL, 101, 'rejection_reason',
               'The cgi module has security liabilities and modern web frameworks have replaced it.',
               1, 'normalized_exact', 1.0, '2019-05-20T14:35:00.000Z')`,
    ).run();

    // Repo 1 Alternatives
    db.prepare(
      `INSERT INTO alternatives (id, decision_id, name, description, outcome, reason, reason_category)
       VALUES (101, 12, 'Keep cgi in standard library', 'Maintain cgi module with security patches.', 'rejected',
               'Security liabilities and availability of modern external alternatives.', 'security')`,
    ).run();

    // Repo 1 Conditions on rejected alternative
    db.prepare(
      `INSERT INTO conditions (id, alternative_id, text, kind, probe, probe_value)
       VALUES (201, 101, 'Requires modern multipart parsing outside the standard library', 'dependency', 'none', NULL)`,
    ).run();

    // Repo 1 Decision Files: Lib/cgi.py marked as deleted/removed (current_path = null)
    db.prepare(
      `INSERT INTO decision_files (decision_id, path, current_path, link_kind, basis, evidence_id)
       VALUES (12, 'Lib/cgi.py', NULL, 'mentioned', 'Directly referenced in PEP 594 dead-batteries removal', 501)`,
    ).run();

    // Repo 1 Second Decision: Standardize on urllib.parse
    db.prepare(
      `INSERT INTO decisions (id, source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at)
       VALUES (14, 10, 1, 'Standardize on urllib.parse', 'accepted', 'active',
               'Standardize URL parsing on Lib/urllib/parse.py.', 0.90, '{"coverage":1,"statement":1,"reasonCoverage":1}', '2019-05-20T15:00:00.000Z')`,
    ).run();

    db.prepare(
      `INSERT INTO decision_files (decision_id, path, current_path, link_kind, basis, evidence_id)
       VALUES (14, 'Lib/urllib/parse.py', 'Lib/urllib/parse.py', 'mentioned', 'Standard URL parser', NULL)`,
    ).run();

    // Repo 2 Decision: React Fiber Reconciliation
    db.prepare(
      `INSERT INTO sources (id, repo_id, kind, external_id, url, title, state, base_commit_sha)
       VALUES (20, 2, 'github_pr', 'facebook/react#100', 'https://github.com/facebook/react/pull/100', 'Fiber Architecture', 'merged', 'baseFiber')`,
    ).run();

    db.prepare(
      `INSERT INTO decisions (id, source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at)
       VALUES (22, 20, 1, 'Adopt React Fiber reconciler', 'accepted', 'active',
               'Rewrite reconciler to enable cooperative scheduling.', 0.95, '{"coverage":1,"statement":1,"reasonCoverage":1}', '2026-10-31T20:00:00.000Z')`,
    ).run();

    db.prepare(
      `INSERT INTO decision_files (decision_id, path, current_path, link_kind, basis, evidence_id)
       VALUES (22, 'packages/react-reconciler/src/ReactFiber.js', 'packages/react-reconciler/src/ReactFiber.js', 'pr_diff', 'Fiber implementation', NULL)`,
    ).run();
  });

  afterEach(() => {
    db.close();
  });

  describe('Input Parsing & Concept Extraction', () => {
    it('parses unified git diffs and extracts modified file paths', () => {
      const diff = `diff --git a/Lib/cgi.py b/Lib/cgi.py
--- a/Lib/cgi.py
+++ b/Lib/cgi.py
@@ -10,3 +10,4 @@
+def parse_multipart_custom(): pass
diff --git a/Lib/urllib/parse.py b/Lib/urllib/parse.py
--- a/Lib/urllib/parse.py
+++ b/Lib/urllib/parse.py
@@ -1,3 +1,4 @@
`;
      const parsed = parsePriorArtInput('diff', diff);
      expect(parsed.changedPaths).toContain('Lib/cgi.py');
      expect(parsed.changedPaths).toContain('Lib/urllib/parse.py');
      expect(parsed.concepts.length).toBeGreaterThan(0);
    });

    it('parses structured JSON input with files array and summary', () => {
      const jsonInput = JSON.stringify({
        title: 'Refactor standard library modules',
        files: ['Lib/cgi.py', 'Lib/urllib/parse.py'],
      });
      const parsed = parsePriorArtInput('pr', jsonInput);
      expect(parsed.summary).toBe('Refactor standard library modules');
      expect(parsed.changedPaths).toEqual(['Lib/cgi.py', 'Lib/urllib/parse.py']);
    });

    it('extracts file paths and concepts from natural language proposals', () => {
      const text =
        'Proposal to re-introduce `Lib/cgi.py` for lightweight CGI scripts without third-party dependencies.';
      const parsed = parsePriorArtInput('idea', text);
      expect(parsed.changedPaths).toContain('Lib/cgi.py');
      expect(parsed.concepts).toContain('lightweight');
      expect(parsed.concepts).toContain('scripts');
      expect(parsed.concepts).not.toContain('the');
      expect(parsed.concepts).not.toContain('for');
    });

    it('rejects directory traversal and unsafe absolute paths during input parsing', () => {
      const input = '../../etc/shadow\nC:/Windows/System32/drivers/etc/hosts\nLib/cgi.py';
      const parsed = parsePriorArtInput('pr', input);
      expect(parsed.changedPaths).toEqual(['Lib/cgi.py']);
    });
  });

  describe('Prior-Art Conflict Detection & Grounding', () => {
    it('detects direct conflict when a proposed change touches a file deprecated/deleted in history', async () => {
      const report = await service.runPriorArtAnalysis(
        1,
        {
          type: 'pr',
          value: 'Restore and modernize Lib/cgi.py for legacy servers',
        },
        101,
        db,
      );

      expect(report.id).toBe(101);
      expect(report.changedPaths).toContain('Lib/cgi.py');
      expect(report.items.length).toBeGreaterThanOrEqual(1);

      const conflictItem = report.items.find((i) => i.decision.id === 12);
      expect(conflictItem).toBeDefined();
      expect(conflictItem?.relation).toBe('conflicts');
      expect(conflictItem?.reason).toContain(
        'Direct conflict: modified file was deprecated or removed',
      );
      expect(conflictItem?.reason).toContain(
        'Remove CGI and related dead-battery modules (PEP 594)',
      );
      expect(conflictItem?.rejectedBecause).toBe(
        'Security liabilities and availability of modern external alternatives.',
      );
      expect(conflictItem?.conditions.length).toBeGreaterThan(0);
      expect(conflictItem?.evidence.length).toBeGreaterThan(0);
      expect(conflictItem?.evidence[0].verified).toBe(true);
      expect(conflictItem?.evidence[0].quote).toContain('security liabilities');

      // Validate against Zod schema
      expect(() => PriorArtReportSchema.parse(report)).not.toThrow();
    });

    it('surfaces related decisions when a touched file has relevant historical architecture without direct conflict', async () => {
      const report = await service.runPriorArtAnalysis(
        1,
        {
          type: 'pr',
          value: 'Optimize query string handling in Lib/urllib/parse.py',
        },
        102,
        db,
      );

      expect(report.changedPaths).toContain('Lib/urllib/parse.py');
      const relatedItem = report.items.find((i) => i.decision.id === 14);

      expect(relatedItem).toBeDefined();
      expect(relatedItem?.relation).toBe('related');
      expect(relatedItem?.reason).toContain(
        'Historical engineering decision governing Lib/urllib/parse.py',
      );
      expect(relatedItem?.decision.title).toBe('Standardize on urllib.parse');
    });

    it('enforces repository isolation: decisions in repo 1 are never surfaced when analyzing repo 2', async () => {
      // Analyze repo 2 with Lib/cgi.py (which belongs to repo 1)
      const reportRepo2 = await service.runPriorArtAnalysis(
        2,
        {
          type: 'pr',
          value: 'Lib/cgi.py',
        },
        103,
        db,
      );

      // Repo 2 must NOT have repo 1 decisions (id 12, 14)
      expect(reportRepo2.items.some((i) => i.decision.id === 12)).toBe(false);
      expect(reportRepo2.items.some((i) => i.decision.id === 14)).toBe(false);
      expect(reportRepo2.items.length).toBe(0);

      // Analyze repo 2 with its own file
      const reportReact = await service.runPriorArtAnalysis(
        2,
        {
          type: 'pr',
          value: 'packages/react-reconciler/src/ReactFiber.js',
        },
        104,
        db,
      );

      expect(reportReact.items.length).toBe(1);
      expect(reportReact.items[0].decision.id).toBe(22);
      expect(reportReact.items[0].decision.title).toBe('Adopt React Fiber reconciler');
    });

    it('handles multiple changed files across different modules in one analysis', async () => {
      const input = `Lib/cgi.py\nLib/urllib/parse.py`;
      const report = await service.runPriorArtAnalysis(
        1,
        {
          type: 'pr',
          value: input,
        },
        105,
        db,
      );

      expect(report.changedPaths.length).toBe(2);
      expect(report.changedPaths).toContain('Lib/cgi.py');
      expect(report.changedPaths).toContain('Lib/urllib/parse.py');
      expect(report.items.length).toBe(2);

      // Conflict item should be sorted first
      expect(report.items[0].relation).toBe('conflicts');
      expect(report.items[0].decision.id).toBe(12);
      expect(report.items[1].relation).toBe('related');
      expect(report.items[1].decision.id).toBe(14);
    });

    it('handles unmapped files cleanly without inventing decisions or crashing', async () => {
      const input = 'src/brand_new_component.tsx\ncomponents/button.tsx';
      const report = await service.runPriorArtAnalysis(
        1,
        {
          type: 'pr',
          value: input,
        },
        106,
        db,
      );

      expect(report.changedPaths).toContain('src/brand_new_component.tsx');
      expect(report.changedPaths).toContain('components/button.tsx');
      expect(report.items.length).toBe(0);
      expect(report.note).toContain('No conflicting or related historical decisions');
    });

    it('handles decisions with missing verified evidence without failing', async () => {
      // Decision 14 has file mapping but no evidence rows
      const report = await service.runPriorArtAnalysis(
        1,
        {
          type: 'pr',
          value: 'Lib/urllib/parse.py',
        },
        107,
        db,
      );

      const item = report.items.find((i) => i.decision.id === 14);
      expect(item).toBeDefined();
      expect(item?.evidence).toEqual([]);
      expect(item?.decision.verifiedRatio).toBe(0);
      expect(item?.reason).toContain('Grounded via repository file mapping');
    });

    it('distinguishes direct verified evidence grounding from inferred discussion mapping', async () => {
      // Decision 12 has verified evidence attached to Lib/cgi.py
      const report1 = await service.runPriorArtAnalysis(
        1,
        { type: 'pr', value: 'Lib/cgi.py' },
        108,
        db,
      );
      const item1 = report1.items.find((i) => i.decision.id === 12);
      expect(item1?.reason).toContain('Grounded by direct verified evidence quote');

      // Decision 14 has file mapping without verified quote
      const report2 = await service.runPriorArtAnalysis(
        1,
        { type: 'pr', value: 'Lib/urllib/parse.py' },
        109,
        db,
      );
      const item2 = report2.items.find((i) => i.decision.id === 14);
      expect(item2?.reason).toContain('Grounded via repository file mapping');
    });

    it('stores and retrieves generated reports by report ID', async () => {
      const report = await service.runPriorArtAnalysis(
        1,
        { type: 'idea', value: 'Remove CGI dead batteries' },
        110,
        db,
      );

      const retrieved = service.getReport(110);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(110);
      expect(retrieved?.input.type).toBe('idea');
    });
  });
});
