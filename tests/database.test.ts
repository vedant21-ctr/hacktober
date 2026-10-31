import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database as DatabaseType } from 'better-sqlite3';
import { closeDatabase, getDatabase, getSchemaSql, initDatabase } from '@decisionvault/server/db';

describe('Database Schema & Integrity', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = initDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase();
  });

  it('applies cleanly to a fresh database', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('raw_responses');
    expect(tableNames).toContain('repositories');
    expect(tableNames).toContain('sources');
    expect(tableNames).toContain('comments');
    expect(tableNames).toContain('comments_fts');
    expect(tableNames).toContain('runs');
    expect(tableNames).toContain('labels');
    expect(tableNames).toContain('decisions');
    expect(tableNames).toContain('decisions_fts');
    expect(tableNames).toContain('alternatives');
    expect(tableNames).toContain('evidence');
    expect(tableNames).toContain('conditions');
    expect(tableNames).toContain('health');
    expect(tableNames).toContain('decision_files');
    expect(tableNames).toContain('decision_events');
    expect(tableNames).toContain('decision_relationships');
    expect(tableNames).toContain('benchmark_cases');
    expect(tableNames).toContain('benchmark_gold');
    expect(tableNames).toContain('benchmark_runs');
    expect(tableNames).toContain('benchmark_matches');
  });

  it('is idempotent when schema is initialized again', () => {
    expect(() => {
      initDatabase(':memory:');
    }).not.toThrow();
  });

  it('enforces CHECK constraints on enums', () => {
    // raw_responses provider CHECK
    expect(() => {
      db.prepare(
        "INSERT INTO raw_responses (provider, request_key, http_status, fetched_at, body) VALUES ('invalid_provider', 'key1', 200, '2026-10-31T00:00:00Z', '{}')",
      ).run();
    }).toThrow(/CHECK constraint failed/);

    // decisions status CHECK
    db.prepare(
      "INSERT INTO repositories (id, full_name, imported_at) VALUES (1, 'org/repo', '2026-10-31T00:00:00Z')",
    ).run();
    db.prepare(
      "INSERT INTO sources (id, repo_id, kind, external_id, url, title) VALUES (1, 1, 'github_issue', '1', 'https://example.com', 'Title')",
    ).run();
    db.prepare(
      "INSERT INTO runs (id, kind, model, mode, prompt_version, params_json, started_at) VALUES (1, 'extract_b', 'gemma4:e4b', 'replay', 'v1', '{}', '2026-10-31T00:00:00Z')",
    ).run();

    expect(() => {
      db.prepare(
        "INSERT INTO decisions (source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at) VALUES (1, 1, 'Title', 'invalid_status', 'active', 'Summary', 0.9, '{}', '2026-10-31T00:00:00Z')",
      ).run();
    }).toThrow(/CHECK constraint failed/);
  });

  it('enforces foreign key constraints', () => {
    // Attempt insert into sources with non-existent repo_id
    expect(() => {
      db.prepare(
        "INSERT INTO sources (repo_id, kind, external_id, url, title) VALUES (9999, 'github_issue', 'issue#999', 'https://example.com', 'Title')",
      ).run();
    }).toThrow(/FOREIGN KEY constraint failed/);
  });

  it('enforces CASCADE delete behavior', () => {
    db.prepare(
      "INSERT INTO repositories (id, full_name, imported_at) VALUES (1, 'test/repo', '2026-10-31T00:00:00Z')",
    ).run();
    db.prepare(
      "INSERT INTO sources (id, repo_id, kind, external_id, url, title) VALUES (1, 1, 'github_issue', 'test/repo#1', 'https://example.com/1', 'Issue 1')",
    ).run();
    db.prepare(
      "INSERT INTO comments (id, source_id, external_id, idx, author, created_at, body, body_norm, url) VALUES (1, 1, 'c1', 0, 'author', '2026-10-31T00:00:00Z', 'Test body', 'test body', 'https://example.com/c1')",
    ).run();

    expect(db.prepare('SELECT COUNT(*) as cnt FROM comments').get()).toEqual({ cnt: 1 });

    // Delete repository, should cascade to source and comment
    db.prepare('DELETE FROM repositories WHERE id = 1').run();

    expect(db.prepare('SELECT COUNT(*) as cnt FROM sources').get()).toEqual({ cnt: 0 });
    expect(db.prepare('SELECT COUNT(*) as cnt FROM comments').get()).toEqual({ cnt: 0 });
  });

  it('synchronizes comments into comments_fts via triggers', () => {
    db.prepare(
      "INSERT INTO repositories (id, full_name, imported_at) VALUES (1, 'test/repo', '2026-10-31T00:00:00Z')",
    ).run();
    db.prepare(
      "INSERT INTO sources (id, repo_id, kind, external_id, url, title) VALUES (1, 1, 'github_issue', 'test/repo#1', 'https://example.com/1', 'Issue 1')",
    ).run();

    db.prepare(
      "INSERT INTO comments (id, source_id, external_id, idx, author, created_at, body, body_norm, url) VALUES (1, 1, 'c1', 0, 'author', '2026-10-31T00:00:00Z', 'Deprecating legacy CGI parser in Python', 'deprecating legacy cgi parser in python', 'https://example.com/c1')",
    ).run();

    // Query comments_fts
    const match = db
      .prepare("SELECT rowid FROM comments_fts WHERE comments_fts MATCH 'CGI'")
      .all() as { rowid: number }[];
    expect(match).toHaveLength(1);
    expect(match[0].rowid).toBe(1);

    // Delete comment, should delete from FTS
    db.prepare('DELETE FROM comments WHERE id = 1').run();
    const afterDelete = db
      .prepare("SELECT rowid FROM comments_fts WHERE comments_fts MATCH 'CGI'")
      .all();
    expect(afterDelete).toHaveLength(0);
  });

  it('synchronizes decisions and alternatives into decisions_fts via triggers', () => {
    db.prepare(
      "INSERT INTO repositories (id, full_name, imported_at) VALUES (1, 'org/repo', '2026-10-31T00:00:00Z')",
    ).run();
    db.prepare(
      "INSERT INTO sources (id, repo_id, kind, external_id, url, title) VALUES (1, 1, 'github_issue', '1', 'https://example.com', 'Title')",
    ).run();
    db.prepare(
      "INSERT INTO runs (id, kind, model, mode, prompt_version, params_json, started_at) VALUES (1, 'extract_b', 'gemma4:e4b', 'replay', 'v1', '{}', '2026-10-31T00:00:00Z')",
    ).run();

    db.prepare(
      "INSERT INTO decisions (id, source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at) VALUES (1, 1, 1, 'Remove dead batteries PEP 594', 'accepted', 'active', 'Summary about standard library cleanup', 0.95, '{}', '2026-10-31T00:00:00Z')",
    ).run();

    // Decision title match
    const titleMatch = db
      .prepare("SELECT rowid FROM decisions_fts WHERE decisions_fts MATCH 'batteries'")
      .all() as { rowid: number }[];
    expect(titleMatch).toHaveLength(1);
    expect(titleMatch[0].rowid).toBe(1);

    // Now insert an alternative for decision 1
    db.prepare(
      "INSERT INTO alternatives (id, decision_id, name, description, outcome, reason, reason_category) VALUES (1, 1, 'Keep audioop module', 'Retain audioop for wave playback', 'rejected', 'Unmaintained code', 'maintenance')",
    ).run();

    // FTS search on alternative name
    const altMatch = db
      .prepare("SELECT rowid FROM decisions_fts WHERE decisions_fts MATCH 'audioop'")
      .all() as { rowid: number }[];
    expect(altMatch).toHaveLength(1);
    expect(altMatch[0].rowid).toBe(1);

    // Delete alternative and verify FTS re-sync
    db.prepare('DELETE FROM alternatives WHERE id = 1').run();
    const afterAltDelete = db
      .prepare("SELECT rowid FROM decisions_fts WHERE decisions_fts MATCH 'audioop'")
      .all();
    expect(afterAltDelete).toHaveLength(0);
  });

  it('handles database transactions with commit and rollback', () => {
    db.prepare(
      "INSERT INTO repositories (id, full_name, imported_at) VALUES (1, 'org/repo', '2026-10-31T00:00:00Z')",
    ).run();

    // Successful transaction
    const insertSuccessful = db.transaction(() => {
      db.prepare(
        "INSERT INTO sources (id, repo_id, kind, external_id, url, title) VALUES (10, 1, 'github_issue', 'tx#1', 'https://example.com/tx1', 'TX 1')",
      ).run();
      db.prepare(
        "INSERT INTO sources (id, repo_id, kind, external_id, url, title) VALUES (11, 1, 'github_issue', 'tx#2', 'https://example.com/tx2', 'TX 2')",
      ).run();
    });
    insertSuccessful();

    const count = db.prepare('SELECT COUNT(*) as count FROM sources').get() as { count: number };
    expect(count.count).toBe(2);

    // Failing transaction that rolls back
    const insertFailing = db.transaction(() => {
      db.prepare(
        "INSERT INTO sources (id, repo_id, kind, external_id, url, title) VALUES (12, 1, 'github_issue', 'tx#3', 'https://example.com/tx3', 'TX 3')",
      ).run();
      // Violates CHECK constraint
      db.prepare(
        "INSERT INTO sources (id, repo_id, kind, external_id, url, title) VALUES (13, 1, 'invalid_kind', 'tx#4', 'https://example.com/tx4', 'TX 4')",
      ).run();
    });

    expect(() => insertFailing()).toThrow();
    // Record with id 12 should have rolled back
    const source12 = db.prepare('SELECT * FROM sources WHERE id = 12').get();
    expect(source12).toBeUndefined();
  });

  it('handles database initialization errors gracefully for invalid paths', () => {
    // Creating a regular file and attempting to use a child path beneath it
    // as the SQLite database location reliably fails (ENOTDIR) across both Windows and Linux
    const tempFilePath = path.join(
      os.tmpdir(),
      'decisionvault-test-invalid-db-' + Date.now() + '.tmp',
    );
    fs.writeFileSync(tempFilePath, 'placeholder');

    try {
      const invalidChildPath = path.join(tempFilePath, 'sub', 'db.sqlite');
      expect(() => initDatabase(invalidChildPath)).toThrow();
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });

  it('exposes getSchemaSql and getDatabase helper functions', () => {
    const sql = getSchemaSql();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');

    closeDatabase();
    const defaultDb = getDatabase();
    expect(defaultDb).toBeDefined();
    const testRow = defaultDb.prepare('SELECT 1 as val').get() as { val: number };
    expect(testRow.val).toBe(1);
  });
});
