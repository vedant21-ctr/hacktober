import { z } from 'zod';
import {
  altOutcomeValues,
  conditionKindValues,
  decisionEventTypeValues,
  decisionStatusValues,
  passALabelValues,
  probeTypeValues,
  reasonCategoryValues,
} from './enums.js';

export const threadLocalCommentIdRegex = /^c\d+$/;

// ==========================================
// Pass A (Section 8.3)
// ==========================================

export const GemmaPassALabelItemSchema = z.object({
  comment: z
    .string()
    .regex(threadLocalCommentIdRegex, 'Comment ID must be thread-local format (e.g. c1, c2)'),
  label: z.enum(passALabelValues),
  alternative: z.string().nullable().optional(),
});
export type GemmaPassALabelItem = z.infer<typeof GemmaPassALabelItemSchema>;

export const GemmaPassAOutputSchema = z.object({
  labels: z.array(GemmaPassALabelItemSchema),
});
export type GemmaPassAOutput = z.infer<typeof GemmaPassAOutputSchema>;

// ==========================================
// Pass B (Section 8.4)
// ==========================================

export const GemmaDecisionEvidenceItemSchema = z.object({
  comment: z
    .string()
    .regex(threadLocalCommentIdRegex, 'Comment ID must be thread-local format (e.g. c1, c2)'),
  quote: z.string().min(1),
});
export type GemmaDecisionEvidenceItem = z.infer<typeof GemmaDecisionEvidenceItemSchema>;

export const GemmaAltEvidenceClaimValues = ['rejection_reason', 'proposal'] as const;
export type GemmaAltEvidenceClaim = (typeof GemmaAltEvidenceClaimValues)[number];

export const GemmaAltEvidenceItemSchema = z.object({
  comment: z
    .string()
    .regex(threadLocalCommentIdRegex, 'Comment ID must be thread-local format (e.g. c1, c2)'),
  quote: z.string().min(1),
  claim: z.enum(GemmaAltEvidenceClaimValues),
});
export type GemmaAltEvidenceItem = z.infer<typeof GemmaAltEvidenceItemSchema>;

export const GemmaConditionSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(conditionKindValues),
  probe: z.enum(probeTypeValues),
  probe_value: z.string().nullable().optional(),
});
export type GemmaCondition = z.infer<typeof GemmaConditionSchema>;

export const GemmaAlternativeSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  outcome: z.enum(altOutcomeValues),
  reason: z.string().nullable().optional(),
  reason_category: z.enum(reasonCategoryValues).nullable().optional(),
  evidence: z.array(GemmaAltEvidenceItemSchema),
  conditions: z.array(GemmaConditionSchema),
});
export type GemmaAlternative = z.infer<typeof GemmaAlternativeSchema>;

export const GemmaEventSchema = z.object({
  comment: z
    .string()
    .regex(threadLocalCommentIdRegex, 'Comment ID must be thread-local format (e.g. c1, c2)'),
  event: z.enum(decisionEventTypeValues),
});
export type GemmaEvent = z.infer<typeof GemmaEventSchema>;

export const GemmaDecisionSchema = z.object({
  title: z.string().min(1),
  status: z.enum(decisionStatusValues),
  summary: z.string(),
  decision_evidence: z.array(GemmaDecisionEvidenceItemSchema),
  alternatives: z.array(GemmaAlternativeSchema),
  events: z.array(GemmaEventSchema),
});
export type GemmaDecision = z.infer<typeof GemmaDecisionSchema>;

export const GemmaPassBOutputSchema = z.object({
  decisions: z.array(GemmaDecisionSchema),
});
export type GemmaPassBOutput = z.infer<typeof GemmaPassBOutputSchema>;
