import type { Database as DatabaseType } from 'better-sqlite3';
import { getDatabase } from '../db/index.js';
import { OllamaClient, OLLAMA_SUPPORTED_MODEL } from '../llm/ollama.js';
import { PassAService } from './passA.js';
import { PassBService, type StoredDecision } from './passB.js';
import { PROMPT_VERSION } from './prompts.js';
import { jobManager } from '../jobs.js';
import { codeMappingService } from '../link/service.js';

export interface ExtractionServiceOptions {
  db?: DatabaseType;
  ollamaClient?: OllamaClient;
}

export interface ExtractionResult {
  runId: number;
  sourcesProcessed: number;
  decisionsRecovered: number;
  decisions: StoredDecision[];
}

export interface ExtractionLock {
  id: number;
  repoId?: number;
  sourceIds: number[];
  release: () => void;
}

/**
 * In-process concurrency lock manager to prevent concurrent extraction jobs
 * from operating on overlapping repositories or sources.
 */
export class ExtractionLockManager {
  private activeLocks: Map<number, ExtractionLock> = new Map();
  private nextLockId = 1;

  public tryAcquire(options: {
    db: DatabaseType;
    repoId?: number;
    sourceIds?: number[];
  }): { acquired: true; release: () => void } | { acquired: false; reason: string } {
    const { db, repoId, sourceIds } = options;

    let targetSourceIds: number[] = [];
    let targetRepoIds: number[] = [];

    if (repoId !== undefined) {
      targetRepoIds.push(repoId);
      const rows = db.prepare('SELECT id FROM sources WHERE repo_id = ?').all(repoId) as Array<{
        id: number;
      }>;
      targetSourceIds.push(...rows.map((r) => r.id));
    }

    if (sourceIds && sourceIds.length > 0) {
      targetSourceIds.push(...sourceIds);
      const placeholders = sourceIds.map(() => '?').join(',');
      const rows = db
        .prepare(
          `SELECT DISTINCT repo_id FROM sources WHERE id IN (${placeholders}) AND repo_id IS NOT NULL`,
        )
        .all(...sourceIds) as Array<{ repo_id: number }>;
      targetRepoIds.push(...rows.map((r) => r.repo_id));
    }

    targetSourceIds = Array.from(new Set(targetSourceIds));
    targetRepoIds = Array.from(new Set(targetRepoIds));

    // Check for overlap against all currently active locks
    for (const lock of this.activeLocks.values()) {
      if (lock.repoId !== undefined && targetRepoIds.includes(lock.repoId)) {
        return {
          acquired: false,
          reason: `Repository #${lock.repoId} is already being extracted by an active job`,
        };
      }

      const hasSourceOverlap = lock.sourceIds.some((sId) => targetSourceIds.includes(sId));
      if (hasSourceOverlap) {
        return {
          acquired: false,
          reason: `One or more target sources are already being extracted by an active job`,
        };
      }
    }

    const lockId = this.nextLockId++;
    const lock: ExtractionLock = {
      id: lockId,
      repoId,
      sourceIds: targetSourceIds,
      release: () => {
        this.activeLocks.delete(lockId);
      },
    };

    this.activeLocks.set(lockId, lock);

    return {
      acquired: true,
      release: lock.release,
    };
  }

  public isLocked(repoId?: number, sourceId?: number): boolean {
    for (const lock of this.activeLocks.values()) {
      if (repoId !== undefined && lock.repoId === repoId) return true;
      if (sourceId !== undefined && lock.sourceIds.includes(sourceId)) return true;
    }
    return false;
  }

  public clear(): void {
    this.activeLocks.clear();
    this.nextLockId = 1;
  }
}

export const extractionLockManager = new ExtractionLockManager();

export class ExtractionService {
  private readonly db: DatabaseType;
  private readonly ollamaClient: OllamaClient;
  private readonly passAService: PassAService;
  private readonly passBService: PassBService;

  constructor(options: ExtractionServiceOptions = {}) {
    this.db = options.db || getDatabase();
    this.ollamaClient = options.ollamaClient || new OllamaClient();
    this.passAService = new PassAService(this.db, this.ollamaClient);
    this.passBService = new PassBService(this.db, this.ollamaClient);
  }

  /**
   * Runs the complete Pass A + Pass B extraction pipeline on targeted sources or a repository.
   * Updates JobManager in background to avoid blocking the Express event loop.
   */
  public async extract(options: {
    jobId?: number;
    repoId?: number;
    sourceIds?: number[];
  }): Promise<ExtractionResult> {
    const { jobId, repoId, sourceIds } = options;

    // 1. Identify sources to process
    let targetSources: Array<{ id: number; title: string }> = [];

    if (sourceIds && sourceIds.length > 0) {
      const placeholders = sourceIds.map(() => '?').join(',');
      targetSources = this.db
        .prepare(`SELECT id, title FROM sources WHERE id IN (${placeholders})`)
        .all(...sourceIds) as Array<{ id: number; title: string }>;
    } else if (repoId !== undefined) {
      targetSources = this.db
        .prepare('SELECT id, title FROM sources WHERE repo_id = ?')
        .all(repoId) as Array<{ id: number; title: string }>;
    } else {
      throw new Error('Either repoId or non-empty sourceIds must be specified for extraction');
    }

    if (!targetSources.length) {
      if (jobId) {
        jobManager.updateJob(jobId, {
          status: 'succeeded',
          stage: 'done',
          progress: { done: 0, total: 0 },
          finishedAt: new Date().toISOString(),
        });
      }
      return {
        runId: 0,
        sourcesProcessed: 0,
        decisionsRecovered: 0,
        decisions: [],
      };
    }

    if (jobId) {
      jobManager.updateJob(jobId, {
        status: 'running',
        stage: 'extract',
        progress: { done: 0, total: targetSources.length },
      });
    }

    // 2. Create master run record for traceability
    const now = new Date().toISOString();
    const runRes = this.db
      .prepare(
        `INSERT INTO runs (kind, model, mode, prompt_version, params_json, started_at, status)
         VALUES ('extract_b', ?, ?, ?, ?, ?, 'running')`,
      )
      .run(
        OLLAMA_SUPPORTED_MODEL,
        this.ollamaClient.mode,
        PROMPT_VERSION,
        JSON.stringify({ repoId, sourceIds: targetSources.map((s) => s.id) }),
        now,
      );

    const masterRunId = Number(runRes.lastInsertRowid);
    const allDecisions: StoredDecision[] = [];

    try {
      for (let i = 0; i < targetSources.length; i++) {
        const source = targetSources[i];

        if (jobId) {
          jobManager.updateJob(jobId, {
            stage: 'extract',
            progress: { done: i, total: targetSources.length },
          });
        }

        // Pass A: Classify discussion comments (in-memory; persisted atomically with decisions in Pass B)
        const passAResult = await this.passAService.classifyComments(source.id, masterRunId, {
          persist: false,
        });

        if (jobId) {
          jobManager.updateJob(jobId, {
            stage: 'verify',
            progress: { done: i + 0.5, total: targetSources.length },
          });
        }

        // Pass B: Extract decisions and verify evidence quotes
        // Atomically replaces previous decisions, labels, and related records in SQLite inside a single transaction
        const decisions = await this.passBService.extractDecisions(
          source.id,
          masterRunId,
          passAResult,
        );

        allDecisions.push(...decisions);

        if (jobId) {
          jobManager.updateJob(jobId, {
            stage: 'extract',
            progress: { done: i + 1, total: targetSources.length },
          });
        }
      }

      // 5. Code Linking: Map recovered decisions to repository files
      if (jobId) {
        jobManager.updateJob(jobId, {
          stage: 'link',
          progress: { done: targetSources.length, total: targetSources.length },
        });
      }
      try {
        codeMappingService.mapDecisionsForSources(
          targetSources.map((s) => s.id),
          this.db,
        );
      } catch (linkErr) {
        console.error('Warning: Code linking step failed during extraction:', linkErr);
      }

      // Mark run as succeeded
      this.db
        .prepare("UPDATE runs SET status = 'succeeded', finished_at = ? WHERE id = ?")
        .run(new Date().toISOString(), masterRunId);

      if (jobId) {
        jobManager.updateJob(jobId, {
          status: 'succeeded',
          stage: 'done',
          progress: { done: targetSources.length, total: targetSources.length },
          finishedAt: new Date().toISOString(),
        });
      }

      return {
        runId: masterRunId,
        sourcesProcessed: targetSources.length,
        decisionsRecovered: allDecisions.length,
        decisions: allDecisions,
      };
    } catch (err) {
      this.db
        .prepare("UPDATE runs SET status = 'failed', finished_at = ? WHERE id = ?")
        .run(new Date().toISOString(), masterRunId);

      if (jobId) {
        jobManager.updateJob(jobId, {
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
          finishedAt: new Date().toISOString(),
        });
      }
      throw err;
    }
  }
}
