import type { Database } from 'better-sqlite3';
import { getDatabase } from '../db/index.js';
import { normalizeText } from '@decisionvault/shared';
import { verifyQuote } from '../verify/evidenceLock.js';
import { DEMO_REPOSITORY } from './data.js';
import type {
  DemoStatusResponse,
  DemoSeedResponse,
  DemoResetResponse,
} from '@decisionvault/shared/api';

export class DemoService {
  /**
   * Queries whether the fictional demo repository is currently seeded.
   */
  public getDemoStatus(customDb?: Database): DemoStatusResponse {
    const db = customDb || getDatabase();

    const repo = db
      .prepare('SELECT id FROM repositories WHERE full_name = ?')
      .get(DEMO_REPOSITORY.fullName) as { id: number } | undefined;

    if (!repo) {
      return {
        seeded: false,
        repoId: null,
        repoName: DEMO_REPOSITORY.fullName,
        sourcesCount: 0,
        decisionsCount: 0,
      };
    }

    const sourcesCount = (
      db.prepare('SELECT COUNT(*) as count FROM sources WHERE repo_id = ?').get(repo.id) as {
        count: number;
      }
    ).count;

    const decisionsCount = (
      db
        .prepare(
          `SELECT COUNT(*) as count FROM decisions d
           JOIN sources s ON d.source_id = s.id
           WHERE s.repo_id = ?`,
        )
        .get(repo.id) as { count: number }
    ).count;

    return {
      seeded: true,
      repoId: repo.id,
      repoName: DEMO_REPOSITORY.fullName,
      sourcesCount,
      decisionsCount,
    };
  }

  /**
   * Safely and idempotently seeds the fictional acme-inc/payment-service repository
   * into the active database with complete evidence lock verification.
   */
  public seedDemoRepository(customDb?: Database): DemoSeedResponse {
    const db = customDb || getDatabase();

    // If already seeded, return existing state idempotently
    const existing = this.getDemoStatus(db);
    if (existing.seeded && existing.repoId) {
      return {
        ok: true,
        repoId: existing.repoId,
        repoName: existing.repoName,
        sourcesCount: existing.sourcesCount,
        decisionsCount: existing.decisionsCount,
        message: 'Fictional demo repository already seeded.',
      };
    }

    const seedTransaction = db.transaction(() => {
      // 1. Insert Repository
      const repoInsert = db
        .prepare(
          `INSERT INTO repositories (full_name, default_branch, head_commit_sha, imported_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(
          DEMO_REPOSITORY.fullName,
          DEMO_REPOSITORY.defaultBranch,
          DEMO_REPOSITORY.headCommitSha,
          DEMO_REPOSITORY.importedAt,
        );

      const repoId = Number(repoInsert.lastInsertRowid);

      // 2. Insert Run Record
      const runInsert = db
        .prepare(
          `INSERT INTO runs (kind, model, mode, prompt_version, params_json, started_at, finished_at, status)
           VALUES ('extract_b', 'gemma4:e4b', 'replay', 'v1', ?, ?, ?, 'succeeded')`,
        )
        .run(
          JSON.stringify({ repo: DEMO_REPOSITORY.fullName, fictionalDemo: true }),
          DEMO_REPOSITORY.importedAt,
          DEMO_REPOSITORY.importedAt,
        );

      const runId = Number(runInsert.lastInsertRowid);

      const decisionIds: number[] = [];

      // 3. Insert Sources, Comments, Decisions, Alternatives, and Evidence
      for (const sourceData of DEMO_REPOSITORY.sources) {
        const sourceInsert = db
          .prepare(
            `INSERT INTO sources (repo_id, kind, external_id, url, title, state, created_at, closed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            repoId,
            sourceData.kind,
            sourceData.externalId,
            sourceData.url,
            sourceData.title,
            sourceData.state,
            sourceData.createdAt,
            sourceData.closedAt,
          );

        const sourceId = Number(sourceInsert.lastInsertRowid);

        // Map external comment ID -> database comment ID and bodyNorm
        const commentIdMap = new Map<string, { id: number; bodyNorm: string }>();

        for (const c of sourceData.comments) {
          const bodyNorm = normalizeText(c.body);
          const commentInsert = db
            .prepare(
              `INSERT INTO comments (source_id, external_id, idx, author, author_role, created_at, body, body_norm, url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              sourceId,
              c.externalId,
              c.idx,
              c.author,
              c.authorRole,
              c.createdAt,
              c.body,
              bodyNorm,
              c.url,
            );

          commentIdMap.set(c.externalId, {
            id: Number(commentInsert.lastInsertRowid),
            bodyNorm,
          });
        }

        // Insert Decision
        const dec = sourceData.decision;
        const decisionInsert = db
          .prepare(
            `INSERT INTO decisions (source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            sourceId,
            runId,
            dec.title,
            dec.status,
            dec.lifecycle,
            dec.summary,
            dec.confidence,
            JSON.stringify(dec.confidenceParts),
            dec.createdAt,
          );

        const decisionId = Number(decisionInsert.lastInsertRowid);
        decisionIds.push(decisionId);

        // Populate decisions_fts for FTS5 concept retrieval
        const altText = dec.alternatives
          .map((a) => `${a.name} ${a.description} ${a.reason}`)
          .join(' ');
        try {
          db.prepare(
            `INSERT INTO decisions_fts (rowid, title, summary, alternatives_text)
             VALUES (?, ?, ?, ?)`,
          ).run(decisionId, dec.title, dec.summary, altText);
        } catch {
          // Virtual table insertion fallback
        }

        // Insert Alternatives
        const alternativeIdMap = new Map<string, number>();

        for (const alt of dec.alternatives) {
          const altInsert = db
            .prepare(
              `INSERT INTO alternatives (decision_id, name, description, outcome, reason, reason_category)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(
              decisionId,
              alt.name,
              alt.description,
              alt.outcome,
              alt.reason,
              alt.reasonCategory,
            );

          const altId = Number(altInsert.lastInsertRowid);
          alternativeIdMap.set(alt.name, altId);
        }

        // Insert Evidence with Exact Verification
        for (const ev of dec.evidence) {
          const commentInfo = commentIdMap.get(ev.commentExternalId);
          if (!commentInfo) continue;

          // Verify quote against normalized comment text
          const verification = verifyQuote(ev.quote, commentInfo.bodyNorm);

          db.prepare(
            `INSERT INTO evidence (decision_id, comment_id, claim_type, quote, verified, verification_method, match_score, match_start, match_end, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            decisionId,
            commentInfo.id,
            ev.claimType,
            ev.quote,
            verification.verified ? 1 : 0,
            verification.method,
            verification.score,
            verification.matchStart ?? null,
            verification.matchEnd ?? null,
            dec.createdAt,
          );
        }

        // Insert Decision Files
        for (const f of dec.files) {
          db.prepare(
            `INSERT INTO decision_files (decision_id, path, current_path, link_kind, basis)
             VALUES (?, ?, ?, ?, ?)`,
          ).run(decisionId, f.path, f.currentPath, f.linkKind, f.basis);
        }

        // Insert Conditions if any
        if (dec.conditions && dec.alternatives.length > 0) {
          const firstAltId = alternativeIdMap.get(dec.alternatives[0].name);
          if (firstAltId) {
            for (const cond of dec.conditions) {
              const condInsert = db
                .prepare(
                  `INSERT INTO conditions (alternative_id, text, kind, probe, probe_value, last_checked_at)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                )
                .run(
                  firstAltId,
                  cond.statement,
                  cond.type,
                  cond.probe,
                  cond.probeValue,
                  dec.createdAt,
                );

              const condId = Number(condInsert.lastInsertRowid);
              const healthState = cond.initialHealthState || 'holds';
              db.prepare(
                `INSERT INTO health (condition_id, state, details, interpretation, checked_at)
                 VALUES (?, ?, ?, ?, ?)`,
              ).run(
                condId,
                healthState,
                cond.healthDetails || 'Constraint verified against repository manifests.',
                cond.interpretation || 'Condition health actively tracked by Reopen Radar.',
                dec.createdAt,
              );
            }
          }
        }

        // Insert Decision Events for timeline
        for (let idx = 0; idx < sourceData.comments.length; idx++) {
          const c = sourceData.comments[idx];
          const commentInfo = commentIdMap.get(c.externalId);
          if (!commentInfo) continue;
          const commentId = commentInfo.id;

          let eventType: 'proposed' | 'objected' | 'agreed' | 'decided' | 'revised' = 'decided';
          if (idx === 0) {
            eventType = 'proposed';
          } else if (idx === 1) {
            eventType = dec.status === 'accepted' ? 'objected' : 'revised';
          } else if (idx === sourceData.comments.length - 1) {
            eventType = 'decided';
          } else {
            eventType = 'agreed';
          }

          const evRow = db
            .prepare('SELECT id FROM evidence WHERE decision_id = ? AND comment_id = ? LIMIT 1')
            .get(decisionId, commentId) as { id: number } | undefined;

          db.prepare(
            `INSERT INTO decision_events (decision_id, comment_id, evidence_id, event_type, occurred_at, source_url)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(decisionId, commentId, evRow?.id ?? null, eventType, c.createdAt, c.url);
        }
      }

      // 4. Insert Cross-Decision Relationships
      if (decisionIds.length >= 5) {
        const evRow2 = db
          .prepare('SELECT id FROM evidence WHERE decision_id = ? LIMIT 1')
          .get(decisionIds[1]) as { id: number } | undefined;
        const evRow3 = db
          .prepare('SELECT id FROM evidence WHERE decision_id = ? LIMIT 1')
          .get(decisionIds[2]) as { id: number } | undefined;
        const evRow5 = db
          .prepare('SELECT id FROM evidence WHERE decision_id = ? LIMIT 1')
          .get(decisionIds[4]) as { id: number } | undefined;

        if (evRow2) {
          // Decision 2 (Queue Processing) supports Decision 4 (Retry with Jitter)
          db.prepare(
            `INSERT INTO decision_relationships (source_decision_id, target_decision_id, relationship_type, evidence_id, created_at)
             VALUES (?, ?, 'supports', ?, ?)`,
          ).run(decisionIds[1], decisionIds[3], evRow2.id, DEMO_REPOSITORY.importedAt);
        }

        if (evRow3) {
          // Decision 3 (Idempotency Keys) supports Decision 2 (Queue Processing)
          db.prepare(
            `INSERT INTO decision_relationships (source_decision_id, target_decision_id, relationship_type, evidence_id, created_at)
             VALUES (?, ?, 'supports', ?, ?)`,
          ).run(decisionIds[2], decisionIds[1], evRow3.id, DEMO_REPOSITORY.importedAt);
        }

        if (evRow5) {
          // Decision 5 (PCI-DSS Tokenization) supports Decision 1 (PostgreSQL Storage)
          db.prepare(
            `INSERT INTO decision_relationships (source_decision_id, target_decision_id, relationship_type, evidence_id, created_at)
             VALUES (?, ?, 'supports', ?, ?)`,
          ).run(decisionIds[4], decisionIds[0], evRow5.id, DEMO_REPOSITORY.importedAt);
        }
      }

      return {
        ok: true,
        repoId,
        repoName: DEMO_REPOSITORY.fullName,
        sourcesCount: DEMO_REPOSITORY.sources.length,
        decisionsCount: decisionIds.length,
        message: 'Fictional demo repository acme-inc/payment-service successfully seeded.',
      };
    });

    return seedTransaction();
  }

  /**
   * Safely resets only the demo repository without touching any real user repositories.
   */
  public resetDemoRepository(customDb?: Database): DemoResetResponse {
    const db = customDb || getDatabase();

    const repo = db
      .prepare('SELECT id FROM repositories WHERE full_name = ?')
      .get(DEMO_REPOSITORY.fullName) as { id: number } | undefined;

    if (!repo) {
      return {
        ok: true,
        deleted: false,
        message: 'No demo repository found to reset.',
      };
    }

    const repoId = repo.id;

    const resetTransaction = db.transaction(() => {
      // Find all decisions belonging to the demo repository
      const decRows = db
        .prepare(
          `SELECT d.id FROM decisions d
           JOIN sources s ON d.source_id = s.id
           WHERE s.repo_id = ?`,
        )
        .all(repoId) as Array<{ id: number }>;

      const decIds = decRows.map((r) => r.id);

      if (decIds.length > 0) {
        const placeholders = decIds.map(() => '?').join(',');

        // 0. Delete decision_events
        db.prepare(`DELETE FROM decision_events WHERE decision_id IN (${placeholders})`).run(
          ...decIds,
        );

        // 1. Delete relationships
        db.prepare(
          `DELETE FROM decision_relationships
           WHERE source_decision_id IN (${placeholders}) OR target_decision_id IN (${placeholders})`,
        ).run(...decIds, ...decIds);

        // 2. Delete decision_files
        db.prepare(`DELETE FROM decision_files WHERE decision_id IN (${placeholders})`).run(
          ...decIds,
        );

        // 3. Delete evidence
        db.prepare(`DELETE FROM evidence WHERE decision_id IN (${placeholders})`).run(...decIds);

        // 4. Delete conditions (and cascade health)
        db.prepare(
          `DELETE FROM conditions WHERE alternative_id IN (SELECT id FROM alternatives WHERE decision_id IN (${placeholders}))`,
        ).run(...decIds);

        // 5. Delete alternatives
        db.prepare(`DELETE FROM alternatives WHERE decision_id IN (${placeholders})`).run(
          ...decIds,
        );

        // 6. Delete decisions_fts
        try {
          db.prepare(`DELETE FROM decisions_fts WHERE rowid IN (${placeholders})`).run(...decIds);
        } catch {
          // ignore FTS cleanup error
        }

        // 7. Delete decisions
        db.prepare(`DELETE FROM decisions WHERE id IN (${placeholders})`).run(...decIds);
      }

      // 8. Delete comments
      db.prepare(
        `DELETE FROM comments WHERE source_id IN (SELECT id FROM sources WHERE repo_id = ?)`,
      ).run(repoId);

      // 9. Delete sources
      db.prepare(`DELETE FROM sources WHERE repo_id = ?`).run(repoId);

      // 10. Delete demo repository
      db.prepare(`DELETE FROM repositories WHERE id = ?`).run(repoId);

      // 11. Delete demo runs
      db.prepare(`DELETE FROM runs WHERE params_json LIKE '%acme-inc/payment-service%'`).run();

      return {
        ok: true,
        deleted: true,
        message: 'Demo repository acme-inc/payment-service successfully reset.',
      };
    });

    return resetTransaction();
  }
}

export const demoService = new DemoService();
