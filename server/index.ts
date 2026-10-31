import express, { Request, Response, NextFunction } from 'express';
import { getDatabase, initDatabase } from './db/index.js';
import { OLLAMA_SUPPORTED_MODEL } from './llm/ollama.js';
import { GitHubIngestService, IngestError, parseGitHubTarget } from './ingest/github.js';
import { jobManager } from './jobs.js';
import type { LlmMode } from '@decisionvault/shared/enums';
import {
  AskRequestSchema,
  BenchmarkConfirmRequestSchema,
  BenchmarkRunRequestSchema,
  CodeWhyQuerySchema,
  DecisionsQuerySchema,
  ExtractRequestSchema,
  ImportRequestSchema,
  JobSchema,
  OverviewQuerySchema,
  OverviewResponseSchema,
  PriorArtRequestSchema,
  RadarQuerySchema,
  RadarRecheckRequestSchema,
  RelationshipsQuerySchema,
  RepositoriesResponseSchema,
  SourceDetailResponseSchema,
  StatusResponseSchema,
} from '@decisionvault/shared/api';

export const app = express();
app.use(express.json());

const notImplementedHandler = (_req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'This endpoint has not been implemented yet.',
    },
  });
};

// GET /api/status
app.get('/api/status', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    // Verify DB can execute a query
    const dbCheck = db.prepare('SELECT 1 as test').get() as { test: number };
    const isDbOk = dbCheck?.test === 1;

    const mode = (process.env.LLM_MODE as LlmMode) || 'replay';

    const response = {
      ok: isDbOk,
      db: isDbOk,
      ollama: {
        reachable: false,
        model: OLLAMA_SUPPORTED_MODEL,
        mode,
        tokensPerSecLast: null,
      },
    };

    const validated = StatusResponseSchema.parse(response);
    res.json(validated);
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Failed to query status',
      },
    });
  }
});

// POST /api/imports
app.post('/api/imports', async (req: Request, res: Response) => {
  const parsed = ImportRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      },
    });
  }

  const { kind, target, limit } = parsed.data;
  if (kind !== 'github_repo') {
    return res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `Import provider kind '${kind}' is not supported yet. Only 'github_repo' is currently implemented.`,
      },
    });
  }

  try {
    parseGitHubTarget(target);
  } catch (err) {
    return res.status(err instanceof IngestError ? err.statusCode : 400).json({
      error: {
        code: err instanceof IngestError ? err.code : 'VALIDATION_ERROR',
        message: err instanceof Error ? err.message : String(err),
      },
    });
  }

  const job = jobManager.createJob('import_github', target);

  // Background execution of GitHub repository ingestion
  const ingestService = new GitHubIngestService();
  ingestService.ingestRepository(job.id, target, limit).catch((err) => {
    console.error(`Background ingestion failed for job #${job.id}:`, err);
  });

  return res.status(202).json({
    jobId: job.id,
  });
});

// POST /api/extract
app.post('/api/extract', (req: Request, res: Response) => {
  const parsed = ExtractRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      },
    });
  }
  return notImplementedHandler(req, res);
});

// GET /api/jobs/:id
app.get('/api/jobs/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Job ID must be an integer',
      },
    });
  }

  const job = jobManager.getJob(id);
  if (!job) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Job #${id} was not found`,
      },
    });
  }

  const validated = JobSchema.parse(job);
  return res.json(validated);
});

// GET /api/repositories
app.get('/api/repositories', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const rows = db
      .prepare(
        'SELECT id, full_name, default_branch, head_commit_sha, clone_path, imported_at FROM repositories ORDER BY id DESC',
      )
      .all() as Array<{
      id: number;
      full_name: string;
      default_branch: string | null;
      head_commit_sha: string | null;
      clone_path: string | null;
      imported_at: string;
    }>;

    const items = rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      defaultBranch: r.default_branch,
      headCommitSha: r.head_commit_sha,
      clonePath: r.clone_path,
      importedAt: r.imported_at,
    }));

    const validated = RepositoriesResponseSchema.parse({ items });
    return res.json(validated);
  } catch (err) {
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Failed to query repositories',
      },
    });
  }
});

// GET /api/overview
app.get('/api/overview', (req: Request, res: Response) => {
  const parsed = OverviewQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      },
    });
  }

  const { repoId } = parsed.data;

  try {
    const db = getDatabase();

    if (repoId !== undefined) {
      const repo = db.prepare('SELECT id FROM repositories WHERE id = ?').get(repoId);
      if (!repo) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Repository #${repoId} was not found`,
          },
        });
      }
    }

    const sourcesQuery =
      repoId !== undefined
        ? db.prepare('SELECT COUNT(*) as count FROM sources WHERE repo_id = ?').get(repoId)
        : db.prepare('SELECT COUNT(*) as count FROM sources').get();
    const sourcesCount = (sourcesQuery as { count: number })?.count || 0;

    const decisionsQuery =
      repoId !== undefined
        ? db
            .prepare(
              'SELECT COUNT(*) as count FROM decisions d JOIN sources s ON d.source_id = s.id WHERE s.repo_id = ?',
            )
            .get(repoId)
        : db.prepare('SELECT COUNT(*) as count FROM decisions').get();
    const decisionsCount = (decisionsQuery as { count: number })?.count || 0;

    const overviewData = {
      counts: {
        sources: sourcesCount,
        decisions: decisionsCount,
        byStatus: {
          accepted: 0,
          rejected: 0,
          unresolved: 0,
        },
        unverifiedClaims: 0,
      },
      attention: [],
      topFiles: [],
    };

    const validated = OverviewResponseSchema.parse(overviewData);
    return res.json(validated);
  } catch (err) {
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Failed to generate overview',
      },
    });
  }
});

// GET /api/decisions
app.get('/api/decisions', (req: Request, res: Response) => {
  const parsed = DecisionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      },
    });
  }
  return notImplementedHandler(req, res);
});

// GET /api/decisions/:id
app.get('/api/decisions/:id', notImplementedHandler);

// GET /api/sources/:id
app.get('/api/sources/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Source ID must be an integer',
      },
    });
  }

  try {
    const db = getDatabase();
    const sourceRow = db
      .prepare(
        'SELECT id, repo_id, kind, external_id, url, title, state, created_at, closed_at, base_commit_sha FROM sources WHERE id = ?',
      )
      .get(id) as
      | {
          id: number;
          repo_id: number | null;
          kind: string;
          external_id: string;
          url: string;
          title: string;
          state: string | null;
          created_at: string | null;
          closed_at: string | null;
          base_commit_sha: string | null;
        }
      | undefined;

    if (!sourceRow) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Source #${id} was not found`,
        },
      });
    }

    const commentRows = db
      .prepare(
        'SELECT id, external_id, parent_comment_id, idx, author, author_role, created_at, body, body_norm, url FROM comments WHERE source_id = ? ORDER BY idx ASC',
      )
      .all(id) as Array<{
      id: number;
      external_id: string;
      parent_comment_id: number | null;
      idx: number;
      author: string;
      author_role: string;
      created_at: string;
      body: string;
      body_norm: string;
      url: string;
    }>;

    const response = {
      source: {
        id: sourceRow.id,
        repoId: sourceRow.repo_id,
        kind: sourceRow.kind,
        externalId: sourceRow.external_id,
        url: sourceRow.url,
        title: sourceRow.title,
        state: sourceRow.state,
        createdAt: sourceRow.created_at,
        closedAt: sourceRow.closed_at,
        baseCommitSha: sourceRow.base_commit_sha,
      },
      comments: commentRows.map((c) => ({
        id: c.id,
        externalId: c.external_id,
        parentCommentId: c.parent_comment_id,
        idx: c.idx,
        author: c.author,
        authorRole: c.author_role,
        createdAt: c.created_at,
        body: c.body,
        bodyNorm: c.body_norm,
        url: c.url,
      })),
    };

    const validated = SourceDetailResponseSchema.parse(response);
    return res.json(validated);
  } catch (err) {
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Failed to query source details',
      },
    });
  }
});

// POST /api/ask
app.post('/api/ask', (req: Request, res: Response) => {
  const parsed = AskRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      },
    });
  }
  return notImplementedHandler(req, res);
});

// GET /api/code/tree
app.get('/api/code/tree', notImplementedHandler);

// GET /api/code/why
app.get('/api/code/why', (req: Request, res: Response) => {
  const parsed = CodeWhyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      },
    });
  }
  return notImplementedHandler(req, res);
});

// GET /api/radar
app.get('/api/radar', (req: Request, res: Response) => {
  const parsed = RadarQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      },
    });
  }
  return notImplementedHandler(req, res);
});

// POST /api/radar/recheck
app.post('/api/radar/recheck', (req: Request, res: Response) => {
  const parsed = RadarRecheckRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      },
    });
  }
  return notImplementedHandler(req, res);
});

// GET /api/timeline/:decisionId
app.get('/api/timeline/:decisionId', notImplementedHandler);

// GET /api/relationships
app.get('/api/relationships', (req: Request, res: Response) => {
  const parsed = RelationshipsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      },
    });
  }
  return notImplementedHandler(req, res);
});

// POST /api/sandbox/prior-art
app.post('/api/sandbox/prior-art', (req: Request, res: Response) => {
  const parsed = PriorArtRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      },
    });
  }
  return notImplementedHandler(req, res);
});

// GET /api/sandbox/reports/:id
app.get('/api/sandbox/reports/:id', notImplementedHandler);

// GET /api/benchmark/cases
app.get('/api/benchmark/cases', notImplementedHandler);

// POST /api/benchmark/run
app.post('/api/benchmark/run', (req: Request, res: Response) => {
  const parsed = BenchmarkRunRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      },
    });
  }
  return notImplementedHandler(req, res);
});

// GET /api/benchmark/runs/:id
app.get('/api/benchmark/runs/:id', notImplementedHandler);

// POST /api/benchmark/runs/:id/confirm
app.post('/api/benchmark/runs/:id/confirm', (req: Request, res: Response) => {
  const parsed = BenchmarkConfirmRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      },
    });
  }
  return notImplementedHandler(req, res);
});

// Fallback 404 handler with standard error shape
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
    },
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred.',
    },
  });
});

export {
  GitHubIngestService,
  IngestError,
  parseGitHubTarget,
  mapAuthorRole,
} from './ingest/github.js';
export { jobManager, JobManager } from './jobs.js';
export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

export function startServer(port: number = PORT) {
  // Ensure DB initialized before listening
  initDatabase();
  return app.listen(port, () => {
    console.log(`DecisionVault server listening on port ${port}`);
  });
}

// Auto-start if run directly
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer();
}
