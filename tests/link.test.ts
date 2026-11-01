import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodeMappingService, normalizeFilePath, extractFilePaths } from '../server/link/service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../server/db/schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

describe('Code Mapping Service & Path Normalization (Phase 3C)', () => {
  let db: Database.Database;
  let service: CodeMappingService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(schemaSql);
    service = new CodeMappingService();
  });

  afterEach(() => {
    db.close();
  });

  describe('Path Normalization & Sanitization', () => {
    it('normalizes standard repository paths', () => {
      expect(normalizeFilePath('server/index.ts')).toBe('server/index.ts');
      expect(normalizeFilePath('apps/web/app/decisions/page.tsx')).toBe(
        'apps/web/app/decisions/page.tsx',
      );
      expect(normalizeFilePath('Lib/cgi.py')).toBe('Lib/cgi.py');
    });

    it('strips markdown backticks, quotes, braces, brackets, and parenthesis', () => {
      expect(normalizeFilePath('`src/auth.ts`')).toBe('src/auth.ts');
      expect(normalizeFilePath('"server/db/schema.sql"')).toBe('server/db/schema.sql');
      expect(normalizeFilePath("'(server/llm/ollama.ts)'")).toBe('server/llm/ollama.ts');
      expect(normalizeFilePath('[shared/api.ts]')).toBe('shared/api.ts');
      expect(normalizeFilePath('{config/default.json}')).toBe('config/default.json');
    });

    it('strips leading ./ and normalizes backslashes to forward slashes', () => {
      expect(normalizeFilePath('./server/index.ts')).toBe('server/index.ts');
      expect(normalizeFilePath('server\\extract\\passB.ts')).toBe('server/extract/passB.ts');
      expect(normalizeFilePath('.\\tests\\link.test.ts')).toBe('tests/link.test.ts');
    });

    it('strips trailing line numbers, anchor tags, line:col pairs, and trailing punctuation', () => {
      expect(normalizeFilePath('server/index.ts:42')).toBe('server/index.ts');
      expect(normalizeFilePath('server/index.ts:42:10')).toBe('server/index.ts');
      expect(normalizeFilePath('apps/web/page.tsx#L10-L20')).toBe('apps/web/page.tsx');
      expect(normalizeFilePath('shared/enums.ts.')).toBe('shared/enums.ts');
      expect(normalizeFilePath('Lib/asyncio.py;')).toBe('Lib/asyncio.py');
      expect(normalizeFilePath('tests/api.test.ts! ')).toBe('tests/api.test.ts');
    });

    it('accepts standalone filenames, standard dotfiles, and scripts/binaries', () => {
      expect(normalizeFilePath('Dockerfile')).toBe('Dockerfile');
      expect(normalizeFilePath('Makefile')).toBe('Makefile');
      expect(normalizeFilePath('README')).toBe('README');
      expect(normalizeFilePath('package.json')).toBe('package.json');
      expect(normalizeFilePath('.gitignore')).toBe('.gitignore');
      expect(normalizeFilePath('scripts/deploy')).toBe('scripts/deploy');
      expect(normalizeFilePath('bin/server')).toBe('bin/server');
    });

    it('rejects directory traversal attempts, absolute paths, Windows drive paths, and null bytes', () => {
      expect(normalizeFilePath('../../etc/passwd')).toBeNull();
      expect(normalizeFilePath('src/../../secrets.env')).toBeNull();
      expect(normalizeFilePath('/etc/shadow')).toBeNull();
      expect(normalizeFilePath('server//index.ts')).toBeNull();
      expect(normalizeFilePath('src/\0malicious.ts')).toBeNull();
      expect(normalizeFilePath('C:/Windows/System32/drivers/etc/hosts')).toBeNull();
      expect(normalizeFilePath('D:\\repo\\file.ts')).toBeNull();
    });

    it('rejects URLs and URI schemes', () => {
      expect(
        normalizeFilePath('https://github.com/owner/repo/blob/main/server/index.ts'),
      ).toBeNull();
      expect(normalizeFilePath('http://example.com/file.ts')).toBeNull();
      expect(normalizeFilePath('ftp://server/archive.zip')).toBeNull();
    });

    it('rejects purely numeric version numbers, English conjunctions, and non-path words', () => {
      expect(normalizeFilePath('2.7')).toBeNull();
      expect(normalizeFilePath('3.11.4')).toBeNull();
      expect(normalizeFilePath('v1.0')).toBeNull();
      expect(normalizeFilePath('hello')).toBeNull();
      expect(normalizeFilePath('and/or')).toBeNull();
      expect(normalizeFilePath('either/or')).toBeNull();
      expect(normalizeFilePath('in/out')).toBeNull();
    });
  });

  describe('Path Extraction from Prose Text', () => {
    it('extracts single and multiple file paths from text blocks', () => {
      const text =
        'We decided to deprecate `Lib/cgi.py` and replace it with `Lib/urllib/parse.py`. See also server/db/schema.sql.';
      const paths = extractFilePaths(text);

      expect(paths).toContain('Lib/cgi.py');
      expect(paths).toContain('Lib/urllib/parse.py');
      expect(paths).toContain('server/db/schema.sql');
    });

    it('ignores URLs and invalid strings during extraction', () => {
      const text =
        'Visit https://github.com/example/repo/issues/1 for details. Check src/auth.ts and version 3.12.';
      const paths = extractFilePaths(text);

      expect(paths).toEqual(['src/auth.ts']);
    });
  });

  describe('Decision-to-Code Mapping & Grounded Evidence', () => {
    beforeEach(() => {
      // Seed a repository
      db.prepare(
        `INSERT INTO repositories (id, full_name, default_branch, head_commit_sha, clone_path, imported_at)
         VALUES (1, 'acme/vault', 'main', 'head1234', NULL, '2026-10-31T20:00:00.000Z')`,
      ).run();

      // Seed run
      db.prepare(
        `INSERT INTO runs (id, kind, model, mode, prompt_version, params_json, started_at, status)
         VALUES (1, 'extract_b', 'gemma4:e4b', 'replay', 'v1', '{}', '2026-10-31T20:00:00.000Z', 'succeeded')`,
      ).run();

      // Seed an issue source
      db.prepare(
        `INSERT INTO sources (id, repo_id, kind, external_id, url, title, state, base_commit_sha)
         VALUES (10, 1, 'github_issue', 'acme/vault#10', 'https://github.com/acme/vault/issues/10', 'Deprecate legacy auth', 'closed', NULL)`,
      ).run();

      // Seed comments
      db.prepare(
        `INSERT INTO comments (id, source_id, external_id, idx, author, author_role, created_at, body, body_norm, url)
         VALUES (101, 10, 'c1', 1, 'alice', 'owner', '2026-10-31T20:01:00.000Z',
                 'We reached consensus to remove src/legacy_auth.py and standardize on src/oauth.ts.',
                 'we reached consensus to remove src/legacy_auth.py and standardize on src/oauth.ts.',
                 'https://github.com/acme/vault/issues/10#c1')`,
      ).run();

      // Seed a decision
      db.prepare(
        `INSERT INTO decisions (id, source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at)
         VALUES (201, 10, 1, 'Standardize on OAuth', 'accepted', 'active', 'Remove legacy auth and standardize on oauth.', 0.95, '{"coverage":1,"statement":1,"reasonCoverage":1}', '2026-10-31T20:05:00.000Z')`,
      ).run();
    });

    it('creates mentioned file associations directly from verified evidence quotes', () => {
      // Seed verified evidence citing src/oauth.ts
      db.prepare(
        `INSERT INTO evidence (id, decision_id, alternative_id, comment_id, claim_type, quote, verified, verification_method, match_score, created_at)
         VALUES (501, 201, NULL, 101, 'decision_statement', 'standardize on src/oauth.ts.', 1, 'normalized_exact', 1.0, '2026-10-31T20:05:00.000Z')`,
      ).run();

      const result = service.mapDecision(201, db);
      expect(result.filesLinked).toBeGreaterThanOrEqual(1);

      const files = service.getFilesForDecision(201, db);
      const oauthFile = files.find((f) => f.path === 'src/oauth.ts');

      expect(oauthFile).toBeDefined();
      expect(oauthFile?.linkKind).toBe('mentioned');
      expect(oauthFile?.currentPath).toBe('src/oauth.ts');
      expect(oauthFile?.evidenceId).toBe(501);
      expect(oauthFile?.basis).toContain('Directly referenced in verified evidence');
    });

    it('extracts PR changed files with pr_diff and commit SHA for PR sources', () => {
      // Seed a PR source
      db.prepare(
        `INSERT INTO sources (id, repo_id, kind, external_id, url, title, state, base_commit_sha)
         VALUES (20, 1, 'github_pr', 'acme/vault#42', 'https://github.com/acme/vault/pull/42', 'Implement SQLite Storage', 'merged', 'baseCommit789')`,
      ).run();

      // Cache PR changed files in raw_responses
      const prFiles = [
        { filename: 'server/db/schema.sql', status: 'modified', sha: 'commitA1' },
        { filename: 'server/index.ts', status: 'modified', sha: 'commitA2' },
      ];
      db.prepare(
        `INSERT INTO raw_responses (provider, request_key, http_status, fetched_at, body)
         VALUES ('github', '/repos/acme/vault/pulls/42/files?per_page=100&page=1', 200, '2026-10-31T20:00:00.000Z', ?)`,
      ).run(JSON.stringify(prFiles));

      // Seed decision under this PR
      db.prepare(
        `INSERT INTO decisions (id, source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at)
         VALUES (202, 20, 1, 'Standardize on SQLite Storage', 'accepted', 'active', 'Use SQLite for local metadata storage.', 0.90, '{"coverage":1,"statement":1,"reasonCoverage":1}', '2026-10-31T20:10:00.000Z')`,
      ).run();

      const result = service.mapDecision(202, db);
      expect(result.filesLinked).toBe(2);

      const files = service.getFilesForDecision(202, db);
      expect(files.length).toBe(2);

      const schemaFile = files.find((f) => f.path === 'server/db/schema.sql');
      expect(schemaFile).toBeDefined();
      expect(schemaFile?.linkKind).toBe('pr_diff');
      expect(schemaFile?.commitSha).toBe('commitA1');
      expect(schemaFile?.basis).toContain('PR #42');
    });

    it('tracks renamed files and maps historical path to current HEAD path', () => {
      db.prepare(
        `INSERT INTO sources (id, repo_id, kind, external_id, url, title, state, base_commit_sha)
         VALUES (30, 1, 'github_pr', 'acme/vault#55', 'https://github.com/acme/vault/pull/55', 'Refactor database module', 'merged', 'commitBase')`,
      ).run();

      const renamedFiles = [
        {
          filename: 'server/db/database.ts',
          previous_filename: 'server/db/sqlite.ts',
          status: 'renamed',
          sha: 'commitRename',
        },
      ];
      db.prepare(
        `INSERT INTO raw_responses (provider, request_key, http_status, fetched_at, body)
         VALUES ('github', '/repos/acme/vault/pulls/55/files?per_page=100&page=1', 200, '2026-10-31T20:00:00.000Z', ?)`,
      ).run(JSON.stringify(renamedFiles));

      db.prepare(
        `INSERT INTO decisions (id, source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at)
         VALUES (203, 30, 1, 'Refactor DB module', 'accepted', 'active', 'Rename sqlite.ts to database.ts.', 0.88, '{"coverage":1,"statement":1,"reasonCoverage":1}', '2026-10-31T20:15:00.000Z')`,
      ).run();

      service.mapDecision(203, db);

      const files = service.getFilesForDecision(203, db);
      const renamed = files.find((f) => f.path === 'server/db/sqlite.ts');

      expect(renamed).toBeDefined();
      expect(renamed?.currentPath).toBe('server/db/database.ts');
      expect(renamed?.linkKind).toBe('rename_tracked');
      expect(renamed?.basis).toContain('Renamed from server/db/sqlite.ts to server/db/database.ts');
    });

    it('marks deleted files with current_path as null', () => {
      db.prepare(
        `INSERT INTO sources (id, repo_id, kind, external_id, url, title, state, base_commit_sha)
         VALUES (40, 1, 'github_pr', 'acme/vault#60', 'https://github.com/acme/vault/pull/60', 'Remove deprecated script', 'merged', 'commitBase')`,
      ).run();

      const removedFiles = [
        {
          filename: 'scripts/legacy_cleanup.sh',
          status: 'removed',
          sha: 'commitRemove',
        },
      ];
      db.prepare(
        `INSERT INTO raw_responses (provider, request_key, http_status, fetched_at, body)
         VALUES ('github', '/repos/acme/vault/pulls/60/files?per_page=100&page=1', 200, '2026-10-31T20:00:00.000Z', ?)`,
      ).run(JSON.stringify(removedFiles));

      db.prepare(
        `INSERT INTO decisions (id, source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at)
         VALUES (204, 40, 1, 'Drop cleanup script', 'accepted', 'active', 'Remove unused legacy script.', 0.90, '{"coverage":1,"statement":1,"reasonCoverage":1}', '2026-10-31T20:20:00.000Z')`,
      ).run();

      service.mapDecision(204, db);

      const files = service.getFilesForDecision(204, db);
      const removed = files.find((f) => f.path === 'scripts/legacy_cleanup.sh');

      expect(removed).toBeDefined();
      expect(removed?.currentPath).toBeNull();
      expect(removed?.basis).toContain('Removed in PR #60');
    });

    it('supports multiple files associated with one decision and multiple decisions associated with one file', () => {
      // Decision 201 associates with src/legacy_auth.py and src/oauth.ts
      service.mapDecision(201, db);

      const files201 = service.getFilesForDecision(201, db);
      expect(files201.length).toBeGreaterThanOrEqual(2);

      // Create a second decision that also touches src/oauth.ts
      db.prepare(
        `INSERT INTO decisions (id, source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at)
         VALUES (205, 10, 1, 'OAuth Token Refresh Policy', 'accepted', 'active', 'Set 30-day token lifetime in src/oauth.ts.', 0.92, '{"coverage":1,"statement":1,"reasonCoverage":1}', '2026-10-31T20:25:00.000Z')`,
      ).run();

      db.prepare(
        `INSERT INTO evidence (id, decision_id, alternative_id, comment_id, claim_type, quote, verified, verification_method, match_score, created_at)
         VALUES (502, 205, NULL, 101, 'decision_statement', 'standardize on src/oauth.ts.', 1, 'normalized_exact', 1.0, '2026-10-31T20:25:00.000Z')`,
      ).run();

      service.mapDecision(205, db);

      // Query decisions associated with src/oauth.ts
      const whyResult = service.getDecisionsForFile('src/oauth.ts', 1, db);
      expect(whyResult.decisions.length).toBe(2);
      expect(whyResult.decisions.some((d) => d.id === 201)).toBe(true);
      expect(whyResult.decisions.some((d) => d.id === 205)).toBe(true);
      expect(whyResult.path).toBe('src/oauth.ts');
    });

    it('ensures mapping is idempotent and does not create duplicate rows on re-run', () => {
      service.mapDecision(201, db);
      const count1 = db
        .prepare('SELECT COUNT(*) as count FROM decision_files WHERE decision_id = 201')
        .get() as { count: number };

      // Second execution
      service.mapDecision(201, db);
      const count2 = db
        .prepare('SELECT COUNT(*) as count FROM decision_files WHERE decision_id = 201')
        .get() as { count: number };

      expect(count2.count).toBe(count1.count);
    });

    it('enforces precedence and does not overwrite verified evidence associations with weaker inferred ones', () => {
      // Verified evidence link with evidenceId
      db.prepare(
        `INSERT INTO evidence (id, decision_id, alternative_id, comment_id, claim_type, quote, verified, verification_method, match_score, created_at)
         VALUES (503, 201, NULL, 101, 'decision_statement', 'consensus to standardize on src/oauth.ts.', 1, 'normalized_exact', 1.0, '2026-10-31T20:05:00.000Z')`,
      ).run();

      service.mapDecision(201, db);

      const before = service.getFilesForDecision(201, db).find((f) => f.path === 'src/oauth.ts');
      expect(before?.evidenceId).toBe(503);

      // Re-running mapping with comment body containing the same path preserves the verified link
      service.mapDecision(201, db);

      const after = service.getFilesForDecision(201, db).find((f) => f.path === 'src/oauth.ts');
      expect(after?.evidenceId).toBe(503);
      expect(after?.basis).toContain('Directly referenced in verified evidence quote');
    });

    it('returns code tree nodes aggregated by decision count', () => {
      service.mapDecision(201, db);

      const tree = service.getCodeTree(1, db);
      expect(Array.isArray(tree)).toBe(true);
      expect(tree.length).toBeGreaterThan(0);

      const firstNode = tree[0];
      expect(firstNode).toHaveProperty('path');
      expect(firstNode).toHaveProperty('decisionCount');
      expect(firstNode.decisionCount).toBeGreaterThanOrEqual(1);
    });

    it('enforces repository isolation when multiple repositories have the same PR number', () => {
      // Seed a second repository
      db.prepare(
        `INSERT INTO repositories (id, full_name, default_branch, head_commit_sha, clone_path, imported_at)
         VALUES (2, 'other/project', 'main', 'head9999', NULL, '2026-10-31T20:00:00.000Z')`,
      ).run();

      // Both repos have PR #42
      // Repo 1 has PR #42 modifying server/index.ts
      // Repo 2 has PR #42 modifying unrelated/secret.ts
      db.prepare(
        `INSERT INTO sources (id, repo_id, kind, external_id, url, title, state, base_commit_sha)
         VALUES (25, 2, 'github_pr', 'other/project#42', 'https://github.com/other/project/pull/42', 'Other PR', 'merged', 'baseOther')`,
      ).run();

      db.prepare(
        `INSERT INTO raw_responses (provider, request_key, http_status, fetched_at, body)
         VALUES ('github', 'https://api.github.com/repos/other/project/pulls/42/files?per_page=100&page=1', 200, '2026-10-31T20:00:00.000Z', ?)`,
      ).run(
        JSON.stringify([{ filename: 'unrelated/secret.ts', status: 'modified', sha: 'secretSha' }]),
      );

      // Repo 1 PR #42 decision
      db.prepare(
        `INSERT INTO sources (id, repo_id, kind, external_id, url, title, state, base_commit_sha)
         VALUES (26, 1, 'github_pr', 'acme/vault#42', 'https://github.com/acme/vault/pull/42', 'Vault PR', 'merged', 'baseVault')`,
      ).run();

      db.prepare(
        `INSERT INTO raw_responses (provider, request_key, http_status, fetched_at, body)
         VALUES ('github', 'https://api.github.com/repos/acme/vault/pulls/42/files?per_page=100&page=1', 200, '2026-10-31T20:00:00.000Z', ?)`,
      ).run(
        JSON.stringify([{ filename: 'server/db/schema.sql', status: 'modified', sha: 'vaultSha' }]),
      );

      db.prepare(
        `INSERT INTO decisions (id, source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at)
         VALUES (206, 26, 1, 'Repo 1 Decision', 'accepted', 'active', 'Summary', 0.9, '{}', '2026-10-31T20:00:00.000Z')`,
      ).run();

      service.mapDecision(206, db);

      const files = service.getFilesForDecision(206, db);
      const paths = files.map((f) => f.path);

      expect(paths).toContain('server/db/schema.sql');
      expect(paths).not.toContain('unrelated/secret.ts');
    });

    it('resolves multi-step rename chains (A -> B -> C) to current HEAD path', () => {
      // PR #70 renames old/core.py -> mid/core.py
      db.prepare(
        `INSERT INTO raw_responses (provider, request_key, http_status, fetched_at, body)
         VALUES ('github', 'https://api.github.com/repos/acme/vault/pulls/70/files?per_page=100&page=1', 200, '2026-10-31T20:00:00.000Z', ?)`,
      ).run(
        JSON.stringify([
          { filename: 'mid/core.py', previous_filename: 'old/core.py', status: 'renamed' },
        ]),
      );

      // PR #71 renames mid/core.py -> current/core.py
      db.prepare(
        `INSERT INTO raw_responses (provider, request_key, http_status, fetched_at, body)
         VALUES ('github', 'https://api.github.com/repos/acme/vault/pulls/71/files?per_page=100&page=1', 200, '2026-10-31T20:00:00.000Z', ?)`,
      ).run(
        JSON.stringify([
          { filename: 'current/core.py', previous_filename: 'mid/core.py', status: 'renamed' },
        ]),
      );

      // Decision citing old/core.py
      db.prepare(
        `INSERT INTO sources (id, repo_id, kind, external_id, url, title, state, base_commit_sha)
         VALUES (72, 1, 'github_issue', 'acme/vault#72', 'https://github.com/acme/vault/issues/72', 'Core Refactor', 'closed', NULL)`,
      ).run();

      db.prepare(
        `INSERT INTO comments (id, source_id, external_id, idx, author, author_role, created_at, body, body_norm, url)
         VALUES (721, 72, 'c72', 1, 'alice', 'owner', '2026-10-31T20:00:00.000Z', 'We modified old/core.py', 'we modified old/core.py', 'url')`,
      ).run();

      db.prepare(
        `INSERT INTO decisions (id, source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at)
         VALUES (207, 72, 1, 'Core Architecture', 'accepted', 'active', 'Summary', 0.9, '{}', '2026-10-31T20:00:00.000Z')`,
      ).run();

      db.prepare(
        `INSERT INTO evidence (id, decision_id, alternative_id, comment_id, claim_type, quote, verified, verification_method, match_score, created_at)
         VALUES (7201, 207, NULL, 721, 'decision_statement', 'modified old/core.py', 1, 'normalized_exact', 1.0, '2026-10-31T20:00:00.000Z')`,
      ).run();

      service.mapDecision(207, db);

      const files = service.getFilesForDecision(207, db);
      const file = files.find((f) => f.path === 'old/core.py');

      expect(file).toBeDefined();
      expect(file?.currentPath).toBe('current/core.py');
    });

    it('updates current_path on existing records when rename is discovered', () => {
      // First map decision without rename knowledge
      db.prepare(
        `INSERT INTO sources (id, repo_id, kind, external_id, url, title, state, base_commit_sha)
         VALUES (80, 1, 'github_issue', 'acme/vault#80', 'https://github.com/acme/vault/issues/80', 'Issue 80', 'closed', NULL)`,
      ).run();

      db.prepare(
        `INSERT INTO comments (id, source_id, external_id, idx, author, author_role, created_at, body, body_norm, url)
         VALUES (801, 80, 'c80', 1, 'alice', 'owner', '2026-10-31T20:00:00.000Z', 'See src/initial.ts', 'see src/initial.ts', 'url')`,
      ).run();

      db.prepare(
        `INSERT INTO decisions (id, source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at)
         VALUES (208, 80, 1, 'Initial Decision', 'accepted', 'active', 'Summary', 0.9, '{}', '2026-10-31T20:00:00.000Z')`,
      ).run();

      db.prepare(
        `INSERT INTO evidence (id, decision_id, alternative_id, comment_id, claim_type, quote, verified, verification_method, match_score, created_at)
         VALUES (8001, 208, NULL, 801, 'decision_statement', 'src/initial.ts', 1, 'normalized_exact', 1.0, '2026-10-31T20:00:00.000Z')`,
      ).run();

      service.mapDecision(208, db);
      let file = service.getFilesForDecision(208, db).find((f) => f.path === 'src/initial.ts');
      expect(file?.currentPath).toBe('src/initial.ts');

      // Now a PR renames src/initial.ts to src/renamed.ts
      db.prepare(
        `INSERT INTO raw_responses (provider, request_key, http_status, fetched_at, body)
         VALUES ('github', 'https://api.github.com/repos/acme/vault/pulls/85/files?per_page=100&page=1', 200, '2026-10-31T20:00:00.000Z', ?)`,
      ).run(
        JSON.stringify([
          { filename: 'src/renamed.ts', previous_filename: 'src/initial.ts', status: 'renamed' },
        ]),
      );

      // Re-run mapping
      service.mapDecision(208, db);
      file = service.getFilesForDecision(208, db).find((f) => f.path === 'src/initial.ts');
      expect(file?.currentPath).toBe('src/renamed.ts');
    });
  });
});
