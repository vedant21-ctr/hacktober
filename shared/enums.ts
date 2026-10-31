/**
 * DecisionVault Shared Enums and Constants
 * Frozen contract types matching Architecture v3 (Sections 6, 8, 11).
 */

export const decisionStatusValues = ['accepted', 'rejected', 'unresolved'] as const;
export type DecisionStatus = (typeof decisionStatusValues)[number];

export const lifecycleValues = ['active', 'superseded'] as const;
export type Lifecycle = (typeof lifecycleValues)[number];

export const altOutcomeValues = ['chosen', 'rejected', 'open'] as const;
export type AltOutcome = (typeof altOutcomeValues)[number];

export const healthStateValues = ['holds', 'may_not_hold', 'unknown'] as const;
export type HealthState = (typeof healthStateValues)[number];

export const verificationMethodValues = ['normalized_exact', 'fuzzy', 'none'] as const;
export type VerificationMethod = (typeof verificationMethodValues)[number];

export const relationTypeValues = ['supersedes', 'contradicts', 'revisits', 'supports'] as const;
export type RelationType = (typeof relationTypeValues)[number];

export const jobStatusValues = ['queued', 'running', 'succeeded', 'failed'] as const;
export type JobStatus = (typeof jobStatusValues)[number];

export const jobStageValues = [
  'ingest',
  'chunk',
  'label',
  'extract',
  'verify',
  'link',
  'health',
  'done',
] as const;
export type JobStage = (typeof jobStageValues)[number];

export const rawResponseProviderValues = ['github', 'discourse', 'file'] as const;
export type RawResponseProvider = (typeof rawResponseProviderValues)[number];

export const sourceKindValues = [
  'github_issue',
  'github_pr',
  'discourse_topic',
  'pep_discussion',
] as const;
export type SourceKind = (typeof sourceKindValues)[number];

export const authorRoleValues = [
  'owner',
  'member',
  'collaborator',
  'contributor',
  'none',
  'unknown',
] as const;
export type AuthorRole = (typeof authorRoleValues)[number];

export const passALabelValues = [
  'proposal',
  'objection',
  'support',
  'decision',
  'rejection',
  'clarification',
  'noise',
] as const;
export type PassALabel = (typeof passALabelValues)[number];

export const reasonCategoryValues = [
  'compatibility',
  'performance',
  'security',
  'maintenance',
  'complexity',
  'policy',
  'infrastructure',
  'other',
] as const;
export type ReasonCategory = (typeof reasonCategoryValues)[number];

export const claimTypeValues = [
  'decision_statement',
  'rejection_reason',
  'proposal',
  'condition',
  'event',
] as const;
export type ClaimType = (typeof claimTypeValues)[number];

export const conditionKindValues = [
  'version',
  'infrastructure',
  'dependency',
  'performance',
  'security',
  'maintenance',
  'policy',
  'other',
] as const;
export type ConditionKind = (typeof conditionKindValues)[number];

export const probeTypeValues = [
  'python_requires',
  'node_engines',
  'dependency_present',
  'ci_python_matrix',
  'later_mentions',
  'none',
] as const;
export type ProbeType = (typeof probeTypeValues)[number];

export const decisionFileLinkKindValues = [
  'mentioned',
  'pr_diff',
  'rename_tracked',
  'symbol',
] as const;
export type DecisionFileLinkKind = (typeof decisionFileLinkKindValues)[number];

export const decisionEventTypeValues = [
  'proposed',
  'objected',
  'agreed',
  'decided',
  'revised',
] as const;
export type DecisionEventType = (typeof decisionEventTypeValues)[number];

export const runKindValues = [
  'extract_a',
  'extract_b',
  'health',
  'ask',
  'prior_art',
  'benchmark',
  'other',
] as const;
export type RunKind = (typeof runKindValues)[number];

export const runStatusValues = ['running', 'succeeded', 'failed'] as const;
export type RunStatus = (typeof runStatusValues)[number];

export const llmModeValues = ['live', 'record', 'replay'] as const;
export type LlmMode = (typeof llmModeValues)[number];

export const llmFailureCategoryValues = [
  'timeout',
  'validation_failed',
  'connection_refused',
  'model_not_found',
  'replay_miss',
  'other',
] as const;
export type LlmFailureCategory = (typeof llmFailureCategoryValues)[number];

export const benchmarkReviewStatusValues = ['unreviewed', 'human_confirmed'] as const;
export type BenchmarkReviewStatus = (typeof benchmarkReviewStatusValues)[number];

export const benchmarkSuggestedByValues = ['lexical', 'gemma', 'human'] as const;
export type BenchmarkSuggestedBy = (typeof benchmarkSuggestedByValues)[number];

export const priorArtRelationValues = ['conflicts', 'related', 'irrelevant'] as const;
export type PriorArtRelation = (typeof priorArtRelationValues)[number];

export const priorArtInputTypeValues = ['idea', 'pr', 'diff'] as const;
export type PriorArtInputType = (typeof priorArtInputTypeValues)[number];

export const importKindValues = ['github_repo', 'discourse_topic', 'file'] as const;
export type ImportKind = (typeof importKindValues)[number];
