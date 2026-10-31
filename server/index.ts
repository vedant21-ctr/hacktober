import express, { Request, Response, NextFunction } from 'express';
import { getDatabase, initDatabase } from './db/index.js';
import { OLLAMA_SUPPORTED_MODEL } from './llm/ollama.js';
import type { LlmMode } from '@decisionvault/shared/enums';
import {
  AskRequestSchema,
  BenchmarkConfirmRequestSchema,
  BenchmarkRunRequestSchema,
  CodeWhyQuerySchema,
  DecisionsQuerySchema,
  ExtractRequestSchema,
  ImportRequestSchema,
  OverviewQuerySchema,
  PriorArtRequestSchema,
  RadarQuerySchema,
  RadarRecheckRequestSchema,
  RelationshipsQuerySchema,
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
app.post('/api/imports', (req: Request, res: Response) => {
  const parsed = ImportRequestSchema.safeParse(req.body);
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
app.get('/api/jobs/:id', notImplementedHandler);

// GET /api/repositories
app.get('/api/repositories', notImplementedHandler);

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
  return notImplementedHandler(req, res);
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
app.get('/api/sources/:id', notImplementedHandler);

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
