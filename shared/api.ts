import { z } from 'zod';
import {
  altOutcomeValues,
  authorRoleValues,
  benchmarkReviewStatusValues,
  benchmarkSuggestedByValues,
  claimTypeValues,
  conditionKindValues,
  decisionEventTypeValues,
  decisionFileLinkKindValues,
  decisionStatusValues,
  healthStateValues,
  importKindValues,
  jobStageValues,
  jobStatusValues,
  lifecycleValues,
  llmModeValues,
  priorArtInputTypeValues,
  priorArtRelationValues,
  probeTypeValues,
  reasonCategoryValues,
  relationTypeValues,
  sourceKindValues,
  verificationMethodValues,
} from './enums.js';

// Common Error
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// GET /api/status
export const StatusResponseSchema = z.object({
  ok: z.boolean(),
  db: z.boolean(),
  ollama: z.object({
    reachable: z.boolean(),
    model: z.string(),
    mode: z.enum(llmModeValues),
    tokensPerSecLast: z.number().nullable(),
  }),
});
export type StatusResponse = z.infer<typeof StatusResponseSchema>;

// POST /api/imports
export const ImportRequestSchema = z.object({
  kind: z.enum(importKindValues),
  target: z.string().min(1),
  limit: z.number().int().positive().optional(),
});
export type ImportRequest = z.infer<typeof ImportRequestSchema>;

export const JobAcceptedResponseSchema = z.object({
  jobId: z.number().int(),
});
export type JobAcceptedResponse = z.infer<typeof JobAcceptedResponseSchema>;

// POST /api/extract
export const ExtractRequestSchema = z
  .object({
    repoId: z.number().int().positive().optional(),
    sourceIds: z.array(z.number().int().positive()).min(1).optional(),
  })
  .refine(
    (data) =>
      data.repoId !== undefined || (data.sourceIds !== undefined && data.sourceIds.length > 0),
    {
      message: 'Either repoId or non-empty sourceIds must be specified',
    },
  );
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;

// GET /api/jobs/:id
export const JobSchema = z.object({
  id: z.number().int(),
  type: z.string(),
  status: z.enum(jobStatusValues),
  stage: z.enum(jobStageValues),
  progress: z.object({
    done: z.number(),
    total: z.number(),
  }),
  tokensPerSec: z.number().optional(),
  error: z.string().optional(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
});
export type Job = z.infer<typeof JobSchema>;

// GET /api/repositories
export const RepositorySchema = z.object({
  id: z.number().int(),
  fullName: z.string(),
  defaultBranch: z.string().nullable().optional(),
  headCommitSha: z.string().nullable().optional(),
  clonePath: z.string().nullable().optional(),
  importedAt: z.string().datetime(),
});
export type Repository = z.infer<typeof RepositorySchema>;

export const RepositoriesResponseSchema = z.object({
  items: z.array(RepositorySchema),
});
export type RepositoriesResponse = z.infer<typeof RepositoriesResponseSchema>;

// Evidence & Conditions
export const EvidenceSchema = z.object({
  id: z.number().int(),
  quote: z.string(),
  claimType: z.enum(claimTypeValues),
  verified: z.boolean(),
  method: z.enum(verificationMethodValues),
  score: z.number().min(0).max(1),
  author: z.string(),
  role: z.string(),
  at: z.string().datetime(),
  url: z.string().url(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ConditionHealthSchema = z.object({
  state: z.enum(healthStateValues),
  signalType: z.string().optional(),
  signalPath: z.string().optional(),
  signalValue: z.string().optional(),
  details: z.string().optional(),
  interpretation: z.string().optional(),
  checkedAt: z.string().datetime(),
});
export type ConditionHealth = z.infer<typeof ConditionHealthSchema>;

export const ConditionSchema = z.object({
  id: z.number().int(),
  text: z.string(),
  kind: z.enum(conditionKindValues),
  probe: z.enum(probeTypeValues),
  probeValue: z.string().nullable().optional(),
  health: ConditionHealthSchema.nullable(),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const AlternativeSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string(),
  outcome: z.enum(altOutcomeValues),
  reason: z.string().nullable().optional(),
  reasonCategory: z.enum(reasonCategoryValues).nullable().optional(),
  evidence: z.array(EvidenceSchema),
  conditions: z.array(ConditionSchema),
});
export type Alternative = z.infer<typeof AlternativeSchema>;

export const DecisionCardSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  status: z.enum(decisionStatusValues),
  lifecycle: z.enum(lifecycleValues),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  sourceUrl: z.string().url(),
  sourceTitle: z.string(),
  verifiedRatio: z.number().min(0).max(1),
});
export type DecisionCard = z.infer<typeof DecisionCardSchema>;

export const DecisionFileSchema = z.object({
  path: z.string(),
  currentPath: z.string().nullable().optional(),
  linkKind: z.enum(decisionFileLinkKindValues),
  basis: z.string(),
  commitSha: z.string().nullable().optional(),
});
export type DecisionFile = z.infer<typeof DecisionFileSchema>;

export const DecisionEventSchema = z.object({
  type: z.enum(decisionEventTypeValues),
  at: z.string().datetime(),
  url: z.string().url(),
});
export type DecisionEvent = z.infer<typeof DecisionEventSchema>;

export const DecisionRelationshipSchema = z.object({
  type: z.enum(relationTypeValues),
  otherId: z.number().int(),
});
export type DecisionRelationship = z.infer<typeof DecisionRelationshipSchema>;

export const ConfidencePartsSchema = z.object({
  coverage: z.number().min(0).max(1),
  statement: z.number().min(0).max(1),
  reasonCoverage: z.number().min(0).max(1),
});
export type ConfidenceParts = z.infer<typeof ConfidencePartsSchema>;

export const DecisionDetailSchema = DecisionCardSchema.extend({
  alternatives: z.array(AlternativeSchema),
  decisionEvidence: z.array(EvidenceSchema),
  files: z.array(DecisionFileSchema),
  events: z.array(DecisionEventSchema),
  relationships: z.array(DecisionRelationshipSchema),
  confidenceParts: ConfidencePartsSchema,
});
export type DecisionDetail = z.infer<typeof DecisionDetailSchema>;

// GET /api/overview?repoId=
export const OverviewQuerySchema = z.object({
  repoId: z.coerce.number().int().optional(),
});
export type OverviewQuery = z.infer<typeof OverviewQuerySchema>;

export const OverviewResponseSchema = z.object({
  counts: z.object({
    sources: z.number().int(),
    decisions: z.number().int(),
    byStatus: z.object({
      accepted: z.number().int(),
      rejected: z.number().int(),
      unresolved: z.number().int(),
    }),
    unverifiedClaims: z.number().int(),
  }),
  attention: z.array(DecisionCardSchema),
  topFiles: z.array(
    z.object({
      path: z.string(),
      decisionCount: z.number().int(),
    }),
  ),
});
export type OverviewResponse = z.infer<typeof OverviewResponseSchema>;

// GET /api/decisions
export const DecisionsQuerySchema = z.object({
  repoId: z.coerce.number().int().positive().optional(),
  status: z.enum(decisionStatusValues).optional(),
  lifecycle: z.enum(lifecycleValues).optional(),
  q: z.string().max(200, 'Search query must not exceed 200 characters').optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(100, 'Page size must not exceed 100')
    .optional()
    .default(20),
});
export type DecisionsQuery = z.infer<typeof DecisionsQuerySchema>;

export const DecisionsResponseSchema = z.object({
  items: z.array(DecisionCardSchema),
  total: z.number().int(),
});
export type DecisionsResponse = z.infer<typeof DecisionsResponseSchema>;

// GET /api/sources/:id
export const CommentSchema = z.object({
  id: z.number().int(),
  externalId: z.string(),
  parentCommentId: z.number().int().nullable().optional(),
  idx: z.number().int(),
  author: z.string(),
  authorRole: z.enum(authorRoleValues),
  createdAt: z.string().datetime(),
  body: z.string(),
  bodyNorm: z.string(),
  url: z.string().url(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const SourceResponseSchema = z.object({
  id: z.number().int(),
  repoId: z.number().int().nullable().optional(),
  kind: z.enum(sourceKindValues),
  externalId: z.string(),
  url: z.string().url(),
  title: z.string(),
  state: z.string().nullable().optional(),
  createdAt: z.string().datetime().nullable().optional(),
  closedAt: z.string().datetime().nullable().optional(),
  baseCommitSha: z.string().nullable().optional(),
});
export type SourceResponse = z.infer<typeof SourceResponseSchema>;

export const SourceDetailResponseSchema = z.object({
  source: SourceResponseSchema,
  comments: z.array(CommentSchema),
});
export type SourceDetailResponse = z.infer<typeof SourceDetailResponseSchema>;

// POST /api/ask
export const AskRequestSchema = z.object({
  repoId: z.number().int(),
  question: z.string().min(1),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const AskResponseSchema = z.object({
  answer: z.string(),
  insufficientEvidence: z.boolean(),
  citations: z.array(
    z.object({
      decisionId: z.number().int(),
      evidence: EvidenceSchema,
    }),
  ),
});
export type AskResponse = z.infer<typeof AskResponseSchema>;

// GET /api/code/tree?repoId=
export const CodeTreeQuerySchema = z.object({
  repoId: z.coerce.number().int().optional(),
});
export type CodeTreeQuery = z.infer<typeof CodeTreeQuerySchema>;

export const CodeTreeNodeSchema = z.object({
  path: z.string(),
  currentPath: z.string().nullable().optional(),
  decisionCount: z.number().int(),
});
export type CodeTreeNode = z.infer<typeof CodeTreeNodeSchema>;

export const CodeTreeResponseSchema = z.object({
  nodes: z.array(CodeTreeNodeSchema),
});
export type CodeTreeResponse = z.infer<typeof CodeTreeResponseSchema>;

// GET /api/code/why?repoId=&path=
export const CodeWhyQuerySchema = z.object({
  repoId: z.coerce.number().int().optional(),
  path: z.string().min(1),
});
export type CodeWhyQuery = z.infer<typeof CodeWhyQuerySchema>;

export const CodeWhyResponseSchema = z.object({
  path: z.string(),
  currentPath: z.string().nullable().optional(),
  decisions: z.array(DecisionCardSchema),
  links: z.array(DecisionFileSchema),
});
export type CodeWhyResponse = z.infer<typeof CodeWhyResponseSchema>;

// GET /api/radar?repoId=&state=
export const RadarQuerySchema = z.object({
  repoId: z.coerce.number().int().optional(),
  state: z.enum(healthStateValues).optional(),
});
export type RadarQuery = z.infer<typeof RadarQuerySchema>;

export const RadarItemSchema = z.object({
  decisionId: z.number().int(),
  title: z.string(),
  alternativeName: z.string(),
  condition: ConditionSchema,
  health: ConditionHealthSchema.nullable(),
});
export type RadarItem = z.infer<typeof RadarItemSchema>;

export const RadarResponseSchema = z.object({
  items: z.array(RadarItemSchema),
});
export type RadarResponse = z.infer<typeof RadarResponseSchema>;

// POST /api/radar/recheck
export const RadarRecheckRequestSchema = z.object({
  decisionId: z.number().int().optional(),
  repoId: z.number().int().optional(),
});
export type RadarRecheckRequest = z.infer<typeof RadarRecheckRequestSchema>;

// GET /api/timeline/:decisionId
export const TimelineEventSchema = z.object({
  type: z.string(),
  at: z.string().datetime(),
  author: z.string(),
  role: z.string(),
  quote: z.string().nullable().optional(),
  sourceUrl: z.string().url(),
  verified: z.boolean(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const TimelineResponseSchema = z.object({
  events: z.array(TimelineEventSchema),
});
export type TimelineResponse = z.infer<typeof TimelineResponseSchema>;

// GET /api/relationships?decisionId=
export const RelationshipsQuerySchema = z.object({
  decisionId: z.coerce.number().int(),
});
export type RelationshipsQuery = z.infer<typeof RelationshipsQuerySchema>;

export const RelationshipItemSchema = z.object({
  type: z.enum(relationTypeValues),
  otherDecision: DecisionCardSchema,
  evidence: EvidenceSchema,
});
export type RelationshipItem = z.infer<typeof RelationshipItemSchema>;

export const RelationshipsResponseSchema = z.object({
  items: z.array(RelationshipItemSchema),
});
export type RelationshipsResponse = z.infer<typeof RelationshipsResponseSchema>;

// POST /api/sandbox/prior-art
export const PriorArtRequestSchema = z.object({
  repoId: z.number().int(),
  input: z.object({
    type: z.enum(priorArtInputTypeValues),
    value: z.string().min(1),
  }),
});
export type PriorArtRequest = z.infer<typeof PriorArtRequestSchema>;

export const PriorArtItemSchema = z.object({
  decision: DecisionCardSchema,
  relation: z.enum(priorArtRelationValues),
  reason: z.string(),
  evidence: z.array(EvidenceSchema),
  rejectedBecause: z.string().nullable().optional(),
  conditions: z.array(ConditionSchema),
  reconsiderIf: z.string(),
});
export type PriorArtItem = z.infer<typeof PriorArtItemSchema>;

export const PriorArtReportSchema = z.object({
  id: z.number().int(),
  input: z.object({
    type: z.string(),
    summary: z.string(),
  }),
  concepts: z.array(z.string()),
  changedPaths: z.array(z.string()),
  items: z.array(PriorArtItemSchema),
  note: z.string(),
});
export type PriorArtReport = z.infer<typeof PriorArtReportSchema>;

// GET /api/benchmark/cases
export const BenchmarkCaseItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  pepNumber: z.number().int().nullable().optional(),
  goldCount: z.number().int(),
  lastRun: z
    .object({
      runId: z.number().int(),
      f1: z.number().nullable().optional(),
      precision: z.number().nullable().optional(),
      recall: z.number().nullable().optional(),
      reviewStatus: z.enum(benchmarkReviewStatusValues),
      createdAt: z.string().datetime(),
    })
    .nullable()
    .optional(),
});
export type BenchmarkCaseItem = z.infer<typeof BenchmarkCaseItemSchema>;

export const BenchmarkCasesResponseSchema = z.object({
  items: z.array(BenchmarkCaseItemSchema),
});
export type BenchmarkCasesResponse = z.infer<typeof BenchmarkCasesResponseSchema>;

// POST /api/benchmark/run
export const BenchmarkRunRequestSchema = z.object({
  caseId: z.number().int(),
});
export type BenchmarkRunRequest = z.infer<typeof BenchmarkRunRequestSchema>;

export const BenchmarkRunAcceptedResponseSchema = z.object({
  jobId: z.number().int(),
  benchmarkRunId: z.number().int().optional(),
});
export type BenchmarkRunAcceptedResponse = z.infer<typeof BenchmarkRunAcceptedResponseSchema>;

// GET /api/benchmark/runs/:id
export const BenchmarkGoldSchema = z.object({
  id: z.number().int(),
  idx: z.number().int(),
  name: z.string(),
  description: z.string(),
  reason: z.string(),
});
export type BenchmarkGold = z.infer<typeof BenchmarkGoldSchema>;

export const BenchmarkPredictionSchema = z.object({
  alternativeId: z.number().int(),
  name: z.string(),
  description: z.string(),
  reason: z.string().nullable().optional(),
});
export type BenchmarkPrediction = z.infer<typeof BenchmarkPredictionSchema>;

export const BenchmarkMatchSchema = z.object({
  id: z.number().int(),
  goldId: z.number().int(),
  alternativeId: z.number().int(),
  suggestedBy: z.enum(benchmarkSuggestedByValues),
  lexicalScore: z.number().nullable().optional(),
  confirmed: z.boolean(),
  reasonGrade: z.number().min(0).max(1).nullable().optional(),
});
export type BenchmarkMatch = z.infer<typeof BenchmarkMatchSchema>;

export const BenchmarkMissSchema = z.object({
  goldId: z.number().int(),
  goldName: z.string(),
  closestPrediction: z.string().nullable().optional(),
});
export type BenchmarkMiss = z.infer<typeof BenchmarkMissSchema>;

export const BenchmarkRunSchema = z.object({
  id: z.number().int(),
  caseId: z.number().int(),
  runId: z.number().int(),
  predictedCount: z.number().int(),
  matchedCount: z.number().int(),
  goldCount: z.number().int(),
  precision: z.number().nullable(),
  recall: z.number().nullable(),
  f1: z.number().nullable(),
  reasonAccuracy: z.number().nullable(),
  reviewStatus: z.enum(benchmarkReviewStatusValues),
  createdAt: z.string().datetime(),
  gold: z.array(BenchmarkGoldSchema),
  predictions: z.array(BenchmarkPredictionSchema),
  matches: z.array(BenchmarkMatchSchema),
  misses: z.array(BenchmarkMissSchema),
});
export type BenchmarkRun = z.infer<typeof BenchmarkRunSchema>;

// POST /api/benchmark/runs/:id/confirm
export const BenchmarkConfirmMatchItemSchema = z.object({
  goldId: z.number().int(),
  alternativeId: z.number().int(),
  confirmed: z.boolean(),
  reasonGrade: z.number().min(0).max(1).nullable().optional(),
});
export type BenchmarkConfirmMatchItem = z.infer<typeof BenchmarkConfirmMatchItemSchema>;

export const BenchmarkConfirmRequestSchema = z.object({
  matches: z.array(BenchmarkConfirmMatchItemSchema),
});
export type BenchmarkConfirmRequest = z.infer<typeof BenchmarkConfirmRequestSchema>;

export const BenchmarkConfirmResponseSchema = z.object({
  ok: z.boolean(),
  benchmarkRunId: z.number().int(),
  updatedMatches: z.number().int(),
  precision: z.number().nullable(),
  recall: z.number().nullable(),
  f1: z.number().nullable(),
  reasonAccuracy: z.number().nullable(),
});
export type BenchmarkConfirmResponse = z.infer<typeof BenchmarkConfirmResponseSchema>;
