import crypto from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { getDatabase } from '../db/index.js';
import type {
  BenchmarkCasesResponse,
  BenchmarkCaseItem,
  BenchmarkRun,
  BenchmarkGold,
  BenchmarkPrediction,
  BenchmarkMatch,
  BenchmarkMiss,
  BenchmarkConfirmResponse,
  BenchmarkConfirmMatchItem,
} from '@decisionvault/shared/api';
import {
  BenchmarkCasesResponseSchema,
  BenchmarkRunSchema,
  BenchmarkConfirmResponseSchema,
} from '@decisionvault/shared/api';

/**
 * Computes token Jaccard similarity between two strings.
 */
export function computeLexicalSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokensA = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
  const tokensB = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? Math.round((intersection / union) * 100) / 100 : 0;
}

export class BenchmarkService {
  /**
   * Ensures default benchmark cases and gold items are seeded in SQLite.
   */
  public ensureSeeded(db: Database): void {
    const existing = db.prepare('SELECT COUNT(*) as count FROM benchmark_cases').get() as {
      count: number;
    };
    if (existing.count > 0) return;

    const goldItems = [
      {
        name: 'Keep parser module',
        description: 'Retain parser module in stdlib',
        reason: 'Replaced by new PEG parser implementation in PEP 617',
      },
      {
        name: 'Retain audioop module indefinitely',
        description: 'Keep audioop in stdlib',
        reason: 'Unmaintained C extension with alternative packages available',
      },
      {
        name: 'Keep cgi module',
        description: 'Retain cgi for simple scripts',
        reason: 'Security liabilities and replacement by WSGI/ASGI multipart parsers',
      },
      {
        name: 'Keep cgitb module',
        description: 'Retain cgitb traceback helper',
        reason: 'Only useful with cgi and unmaintained',
      },
      {
        name: 'Retain chunk module',
        description: 'Keep chunk audio helper',
        reason: 'Legacy format parser with low usage',
      },
      {
        name: 'Keep crypt module',
        description: 'Retain crypt module',
        reason: 'Unix-only legacy password hashing with passlib/hashlib replacements',
      },
      {
        name: 'Keep imghdr module',
        description: 'Retain image header detector',
        reason: 'Limited format support superseded by filetype/puremagic',
      },
      {
        name: 'Keep mailcap module',
        description: 'Retain mailcap MIME helper',
        reason: 'Obsolete Unix mail configuration format',
      },
      {
        name: 'Keep msilib module',
        description: 'Retain Windows MSI creation library',
        reason: 'Windows-only legacy packaging tool',
      },
      {
        name: 'Keep nis module',
        description: 'Retain NIS network information service',
        reason: 'Obsolete Yellow Pages protocol rarely used',
      },
      {
        name: 'Keep nntplib module',
        description: 'Retain Usenet client library',
        reason: 'Usenet protocol rarely used in modern deployments',
      },
      {
        name: 'Keep ossaudiodev module',
        description: 'Retain OSS sound system interface',
        reason: 'Superseded by ALSA on modern Linux',
      },
      {
        name: 'Keep pipes module',
        description: 'Retain shell pipeline helper',
        reason: 'Superseded by subprocess module',
      },
      {
        name: 'Keep sndhdr module',
        description: 'Retain sound header reader',
        reason: 'Limited audio header parsing',
      },
      {
        name: 'Keep spwd module',
        description: 'Retain shadow password reader',
        reason: 'Unix shadow password legacy access',
      },
      {
        name: 'Keep sunau module',
        description: 'Retain Sun AU audio reader',
        reason: 'Obsolete Sun audio format',
      },
      {
        name: 'Keep telnetlib module',
        description: 'Retain Telnet protocol client',
        reason: 'Insecure unencrypted protocol superseded by SSH',
      },
      {
        name: 'Keep uu module',
        description: 'Retain UUencode encoder/decoder',
        reason: 'Superseded by base64 encoding',
      },
      {
        name: 'Keep xdrlib module',
        description: 'Retain XDR data representation',
        reason: 'Sun RPC format rarely used',
      },
    ];

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(goldItems))
      .digest('hex')
      .slice(0, 16);

    const insertCaseStmt = db.prepare(
      `INSERT INTO benchmark_cases (id, name, pep_number, source_id, gold_hash)
       VALUES (1, 'PEP 594: Removing dead batteries', 594, NULL, ?)`,
    );

    const insertGoldStmt = db.prepare(
      `INSERT INTO benchmark_gold (case_id, idx, name, description, reason)
       VALUES (1, ?, ?, ?, ?)`,
    );

    const tx = db.transaction(() => {
      insertCaseStmt.run(hash);
      for (let i = 0; i < goldItems.length; i++) {
        const item = goldItems[i];
        insertGoldStmt.run(i, item.name, item.description, item.reason);
      }
    });

    tx();
  }

  /**
   * Retrieves all benchmark cases (`GET /api/benchmark/cases`).
   */
  public getCases(customDb?: Database): BenchmarkCasesResponse {
    const db = customDb || getDatabase();
    this.ensureSeeded(db);

    const cases = db
      .prepare(
        `SELECT bc.id, bc.name, bc.pep_number,
                COUNT(bg.id) as gold_count
         FROM benchmark_cases bc
         LEFT JOIN benchmark_gold bg ON bc.id = bg.case_id
         GROUP BY bc.id
         ORDER BY bc.id ASC`,
      )
      .all() as Array<{
      id: number;
      name: string;
      pep_number: number | null;
      gold_count: number;
    }>;

    const latestRunStmt = db.prepare(
      `SELECT id, f1, precision, recall, review_status, created_at
       FROM benchmark_runs
       WHERE case_id = ?
       ORDER BY id DESC LIMIT 1`,
    );

    const items: BenchmarkCaseItem[] = [];

    for (const c of cases) {
      const run = latestRunStmt.get(c.id) as
        | {
            id: number;
            f1: number | null;
            precision: number | null;
            recall: number | null;
            review_status: any;
            created_at: string;
          }
        | undefined;

      items.push({
        id: c.id,
        name: c.name,
        pepNumber: c.pep_number,
        goldCount: c.gold_count,
        lastRun: run
          ? {
              runId: run.id,
              f1: run.f1,
              precision: run.precision,
              recall: run.recall,
              reviewStatus: run.review_status,
              createdAt: new Date(run.created_at).toISOString(),
            }
          : null,
      });
    }

    return BenchmarkCasesResponseSchema.parse({ items });
  }

  /**
   * Runs candidate matching against predicted rejected alternatives (`POST /api/benchmark/run`).
   */
  public runBenchmark(caseId: number, customDb?: Database): { runId: number } {
    const db = customDb || getDatabase();
    this.ensureSeeded(db);

    const caseRow = db.prepare('SELECT id, name FROM benchmark_cases WHERE id = ?').get(caseId);
    if (!caseRow) {
      throw new Error(`Benchmark case #${caseId} was not found`);
    }

    const goldItems = db
      .prepare(
        'SELECT id, idx, name, description, reason FROM benchmark_gold WHERE case_id = ? ORDER BY idx ASC',
      )
      .all(caseId) as Array<{
      id: number;
      idx: number;
      name: string;
      description: string;
      reason: string;
    }>;

    // Retrieve predicted alternatives with outcome = 'rejected'
    const predictions = db
      .prepare(
        `SELECT id, name, description, reason
         FROM alternatives
         WHERE outcome = 'rejected'
         ORDER BY id ASC`,
      )
      .all() as Array<{ id: number; name: string; description: string; reason: string | null }>;

    // Candidate matching: compute token Jaccard similarity
    const matchesToInsert: Array<{
      goldId: number;
      alternativeId: number;
      score: number;
    }> = [];

    const matchedGoldIds = new Set<number>();

    for (const gold of goldItems) {
      let bestScore = 0;
      let bestPred: (typeof predictions)[0] | null = null;

      for (const pred of predictions) {
        const textGold = `${gold.name} ${gold.description} ${gold.reason}`;
        const textPred = `${pred.name} ${pred.description} ${pred.reason || ''}`;
        const score = computeLexicalSimilarity(textGold, textPred);

        if (score > bestScore) {
          bestScore = score;
          bestPred = pred;
        }
      }

      if (bestPred && bestScore >= 0.25) {
        matchesToInsert.push({
          goldId: gold.id,
          alternativeId: bestPred.id,
          score: bestScore,
        });
        matchedGoldIds.add(gold.id);
      }
    }

    const matchedCount = matchesToInsert.length;
    const goldCount = goldItems.length;
    const predictedCount = Math.max(predictions.length, matchedCount);

    const precision =
      predictedCount > 0 ? Math.round((matchedCount / predictedCount) * 1000) / 1000 : 0;
    const recall = goldCount > 0 ? Math.round((matchedCount / goldCount) * 1000) / 1000 : 0;
    const f1 =
      precision + recall > 0
        ? Math.round(((2 * precision * recall) / (precision + recall)) * 1000) / 1000
        : 0;

    const now = new Date().toISOString();

    let benchmarkRunId = 0;

    const tx = db.transaction(() => {
      // Create master run entry
      const runResult = db
        .prepare(
          `INSERT INTO runs (kind, model, mode, prompt_version, params_json, started_at, finished_at, status)
           VALUES ('benchmark', 'gemma4:e4b', 'replay', 'v1', ?, ?, ?, 'succeeded')`,
        )
        .run(JSON.stringify({ caseId }), now, now);

      const runId = Number(runResult.lastInsertRowid);

      const bRunResult = db
        .prepare(
          `INSERT INTO benchmark_runs (case_id, run_id, predicted_count, matched_count, gold_count, precision, recall, f1, reason_accuracy, review_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'unreviewed', ?)`,
        )
        .run(caseId, runId, predictedCount, matchedCount, goldCount, precision, recall, f1, now);

      benchmarkRunId = Number(bRunResult.lastInsertRowid);

      const insertMatchStmt = db.prepare(
        `INSERT INTO benchmark_matches (benchmark_run_id, gold_id, alternative_id, suggested_by, lexical_score, confirmed, reason_grade)
         VALUES (?, ?, ?, 'lexical', ?, 0, NULL)`,
      );

      for (const m of matchesToInsert) {
        insertMatchStmt.run(benchmarkRunId, m.goldId, m.alternativeId, m.score);
      }
    });

    tx();

    return { runId: benchmarkRunId };
  }

  /**
   * Retrieves full benchmark run details (`GET /api/benchmark/runs/:id`).
   */
  public getBenchmarkRun(id: number, customDb?: Database): BenchmarkRun | null {
    const db = customDb || getDatabase();
    this.ensureSeeded(db);

    const runRow = db
      .prepare(
        `SELECT id, case_id, run_id, predicted_count, matched_count, gold_count,
                precision, recall, f1, reason_accuracy, review_status, created_at
         FROM benchmark_runs
         WHERE id = ?`,
      )
      .get(id) as
      | {
          id: number;
          case_id: number;
          run_id: number;
          predicted_count: number;
          matched_count: number;
          gold_count: number;
          precision: number | null;
          recall: number | null;
          f1: number | null;
          reason_accuracy: number | null;
          review_status: any;
          created_at: string;
        }
      | undefined;

    if (!runRow) return null;

    // Gold items
    const goldRows = db
      .prepare(
        'SELECT id, idx, name, description, reason FROM benchmark_gold WHERE case_id = ? ORDER BY idx ASC',
      )
      .all(runRow.case_id) as BenchmarkGold[];

    // Predicted alternatives
    const predRows = db
      .prepare(
        `SELECT a.id as alternativeId, a.name, a.description, a.reason
         FROM alternatives a
         WHERE a.outcome = 'rejected'
         ORDER BY a.id ASC`,
      )
      .all() as BenchmarkPrediction[];

    // Matches
    const matchRows = db
      .prepare(
        `SELECT id, gold_id as goldId, alternative_id as alternativeId, suggested_by as suggestedBy,
                lexical_score as lexicalScore, confirmed, reason_grade as reasonGrade
         FROM benchmark_matches
         WHERE benchmark_run_id = ?
         ORDER BY id ASC`,
      )
      .all(id) as Array<{
      id: number;
      goldId: number;
      alternativeId: number;
      suggestedBy: any;
      lexicalScore: number | null;
      confirmed: number;
      reasonGrade: number | null;
    }>;

    const matches: BenchmarkMatch[] = matchRows.map((m) => ({
      id: m.id,
      goldId: m.goldId,
      alternativeId: m.alternativeId,
      suggestedBy: m.suggestedBy,
      lexicalScore: m.lexicalScore,
      confirmed: m.confirmed === 1,
      reasonGrade: m.reasonGrade,
    }));

    // Misses: gold items without a match
    const matchedGoldIds = new Set(matches.map((m) => m.goldId));
    const misses: BenchmarkMiss[] = [];

    for (const g of goldRows) {
      if (!matchedGoldIds.has(g.id)) {
        // Find closest prediction if any
        let closest: string | null = null;
        let maxSim = 0;
        for (const p of predRows) {
          const sim = computeLexicalSimilarity(g.name, p.name);
          if (sim > maxSim) {
            maxSim = sim;
            closest = p.name;
          }
        }
        misses.push({
          goldId: g.id,
          goldName: g.name,
          closestPrediction: closest,
        });
      }
    }

    const report: BenchmarkRun = {
      id: runRow.id,
      caseId: runRow.case_id,
      runId: runRow.run_id,
      predictedCount: runRow.predicted_count,
      matchedCount: matches.length,
      goldCount: runRow.gold_count,
      precision: runRow.precision,
      recall: runRow.recall,
      f1: runRow.f1,
      reasonAccuracy: runRow.reason_accuracy,
      reviewStatus: runRow.review_status,
      createdAt: new Date(runRow.created_at).toISOString(),
      gold: goldRows,
      predictions: predRows,
      matches,
      misses,
    };

    return BenchmarkRunSchema.parse(report);
  }

  /**
   * Confirms human review grades and recalculates metrics (`POST /api/benchmark/runs/:id/confirm`).
   */
  public confirmMatches(
    runId: number,
    matches: BenchmarkConfirmMatchItem[],
    customDb?: Database,
  ): BenchmarkConfirmResponse | null {
    const db = customDb || getDatabase();
    this.ensureSeeded(db);

    const runRow = db
      .prepare('SELECT id, gold_count, predicted_count FROM benchmark_runs WHERE id = ?')
      .get(runId) as { id: number; gold_count: number; predicted_count: number } | undefined;

    if (!runRow) return null;

    const updateMatchStmt = db.prepare(
      `UPDATE benchmark_matches
       SET confirmed = ?, reason_grade = ?
       WHERE benchmark_run_id = ? AND gold_id = ? AND alternative_id = ?`,
    );

    let updatedCount = 0;

    const tx = db.transaction(() => {
      for (const m of matches) {
        const result = updateMatchStmt.run(
          m.confirmed ? 1 : 0,
          m.reasonGrade !== undefined ? m.reasonGrade : null,
          runId,
          m.goldId,
          m.alternativeId,
        );
        updatedCount += result.changes;
      }

      // Re-read confirmed matches to compute metrics
      const confirmedRows = db
        .prepare(
          `SELECT confirmed, reason_grade
           FROM benchmark_matches
           WHERE benchmark_run_id = ? AND confirmed = 1`,
        )
        .all(runId) as Array<{ confirmed: number; reason_grade: number | null }>;

      const confirmedCount = confirmedRows.length;
      const precision =
        runRow.predicted_count > 0
          ? Math.round((confirmedCount / runRow.predicted_count) * 1000) / 1000
          : 0;
      const recall =
        runRow.gold_count > 0 ? Math.round((confirmedCount / runRow.gold_count) * 1000) / 1000 : 0;
      const f1 =
        precision + recall > 0
          ? Math.round(((2 * precision * recall) / (precision + recall)) * 1000) / 1000
          : 0;

      const grades = confirmedRows
        .map((r) => r.reason_grade)
        .filter((g): g is number => g !== null);
      const reasonAccuracy =
        grades.length > 0
          ? Math.round((grades.reduce((sum, val) => sum + val, 0) / grades.length) * 1000) / 1000
          : null;

      db.prepare(
        `UPDATE benchmark_runs
         SET review_status = 'human_confirmed', precision = ?, recall = ?, f1 = ?, reason_accuracy = ?
         WHERE id = ?`,
      ).run(precision, recall, f1, reasonAccuracy, runId);
    });

    tx();

    // Re-fetch updated metrics
    const updatedRun = db
      .prepare('SELECT precision, recall, f1, reason_accuracy FROM benchmark_runs WHERE id = ?')
      .get(runId) as {
      precision: number | null;
      recall: number | null;
      f1: number | null;
      reason_accuracy: number | null;
    };

    const response: BenchmarkConfirmResponse = {
      ok: true,
      benchmarkRunId: runId,
      updatedMatches: updatedCount,
      precision: updatedRun.precision,
      recall: updatedRun.recall,
      f1: updatedRun.f1,
      reasonAccuracy: updatedRun.reason_accuracy,
    };

    return BenchmarkConfirmResponseSchema.parse(response);
  }
}

export const benchmarkService = new BenchmarkService();
