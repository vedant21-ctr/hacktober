import type { Database as DatabaseType } from 'better-sqlite3';
import { GemmaPassBOutputSchema, type GemmaDecision } from '@decisionvault/shared/gemma';
import type { DecisionStatus, SourceKind } from '@decisionvault/shared/enums';
import { OllamaClient, OLLAMA_SUPPORTED_MODEL } from '../llm/ollama.js';
import {
  verifyQuote,
  calculateDecisionConfidence,
  type EvidenceVerificationResult,
} from '../verify/evidenceLock.js';
import { PASS_B_SYSTEM_PROMPT, PROMPT_VERSION, formatCommentForPrompt } from './prompts.js';
import type { PassAResult, SourceComment } from './passA.js';

export interface StoredEvidence {
  id: number;
  claimType: string;
  quote: string;
  verified: boolean;
  method: string;
  score: number;
  commentId: number;
  author: string;
  authorRole: string;
  url: string;
}

export interface StoredAlternative {
  id: number;
  name: string;
  description: string;
  outcome: string;
  reason: string | null;
  reasonCategory: string | null;
  evidence: StoredEvidence[];
}

export interface StoredDecision {
  id: number;
  sourceId: number;
  runId: number;
  title: string;
  status: DecisionStatus;
  summary: string;
  confidence: number;
  confidenceParts: string;
  alternatives: StoredAlternative[];
  decisionEvidence: StoredEvidence[];
  verifiedCount: number;
  unverifiedCount: number;
}

export class PassBService {
  constructor(
    private readonly db: DatabaseType,
    private readonly ollamaClient: OllamaClient = new OllamaClient(),
  ) {}

  public async extractDecisions(
    sourceId: number,
    runId: number,
    passAResult: PassAResult,
  ): Promise<StoredDecision[]> {
    const { labels, commentMap } = passAResult;

    // Filter relevant comments (decisions, proposals, objections, support, rejection)
    // If few comments total, provide all comments for maximum context
    const labelByThreadId = new Map<string, string>();
    labels.forEach((l) => labelByThreadId.set(l.threadLocalId, l.label));

    const commentsToInclude: Array<{ threadLocalId: string; comment: SourceComment }> = [];

    commentMap.forEach((comment, threadLocalId) => {
      const lbl = labelByThreadId.get(threadLocalId);
      if (
        commentMap.size <= 15 ||
        !lbl ||
        ['decision', 'proposal', 'objection', 'support', 'rejection'].includes(lbl)
      ) {
        commentsToInclude.push({ threadLocalId, comment });
      }
    });

    if (!commentsToInclude.length) {
      return [];
    }

    const promptSegments = commentsToInclude.map(({ threadLocalId, comment }) => {
      const label = labelByThreadId.get(threadLocalId) || 'context';
      return formatCommentForPrompt(
        threadLocalId,
        comment.author,
        `${comment.authorRole}:${label}`,
        comment.body,
      );
    });

    const labelSummary = labels
      .map((l) => `${l.threadLocalId}: ${l.label}${l.altName ? ` (${l.altName})` : ''}`)
      .join(', ');

    const userPrompt = `Extract decisions from discussion #${sourceId}.\nPass A classifications: ${labelSummary || 'None'}\n\n${promptSegments.join('\n\n')}`;

    const chatResponse = await this.ollamaClient.chat<{
      decisions: GemmaDecision[];
    }>({
      model: OLLAMA_SUPPORTED_MODEL,
      promptVersion: PROMPT_VERSION,
      systemPrompt: PASS_B_SYSTEM_PROMPT,
      userPrompt,
      schemaHash: 'pass_b_schema_v1',
    });

    const parsed = GemmaPassBOutputSchema.safeParse(chatResponse.data);
    if (!parsed.success) {
      throw new Error(`Gemma Pass B output failed schema validation: ${parsed.error.message}`);
    }

    const rawDecisions = parsed.data.decisions;
    const now = new Date().toISOString();
    const storedDecisions: StoredDecision[] = [];

    // Prepared statements for atomic insertion
    const insertDecisionStmt = this.db.prepare(
      `INSERT INTO decisions (source_id, run_id, title, status, lifecycle, summary, confidence, confidence_parts, last_verified_at, created_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
    );

    const insertAltStmt = this.db.prepare(
      `INSERT INTO alternatives (decision_id, name, description, outcome, reason, reason_category)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    const insertEvidenceStmt = this.db.prepare(
      `INSERT INTO evidence (decision_id, alternative_id, comment_id, claim_type, quote, verified, verification_method, match_score, match_start, match_end, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const insertConditionStmt = this.db.prepare(
      `INSERT INTO conditions (alternative_id, evidence_id, text, kind, probe, probe_value, last_checked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    const insertEventStmt = this.db.prepare(
      `INSERT INTO decision_events (decision_id, comment_id, evidence_id, event_type, occurred_at, source_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    const insertLabelStmt = this.db.prepare(
      `INSERT INTO labels (comment_id, run_id, label, alt_name)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(comment_id, run_id) DO UPDATE SET
         label = excluded.label,
         alt_name = excluded.alt_name`,
    );

    const persistTx = this.db.transaction(() => {
      // 1. Atomically delete prior decisions for this source
      // Cascades to alternatives, evidence, conditions, health, events, files, relationships, and triggers FTS delete
      const existingDecisions = this.db
        .prepare('SELECT id FROM decisions WHERE source_id = ?')
        .all(sourceId) as Array<{ id: number }>;
      for (const d of existingDecisions) {
        this.db.prepare('DELETE FROM decisions WHERE id = ?').run(d.id);
      }

      // 2. Delete prior labels for this source's comments
      this.db
        .prepare(
          'DELETE FROM labels WHERE comment_id IN (SELECT id FROM comments WHERE source_id = ?)',
        )
        .run(sourceId);

      // 3. Atomically persist fresh Pass A labels
      for (const l of labels) {
        insertLabelStmt.run(l.commentId, runId, l.label, l.altName);
      }

      if (!rawDecisions.length) {
        return;
      }

      for (const dec of rawDecisions) {
        let verifiedEvidenceWeight = 0;
        let totalEvidenceClaimed = 0;
        let hasVerifiedDecisionStatement = false;
        let statementAuthorRole = 'unknown';

        interface VerifiedEvidenceItem {
          commentId: number;
          claimType: string;
          quote: string;
          verification: EvidenceVerificationResult;
          author: string;
          authorRole: string;
          url: string;
        }

        // 1. Verify decision evidence quotes
        const verifiedDecisionEvidence: VerifiedEvidenceItem[] = [];
        for (const dev of dec.decision_evidence) {
          totalEvidenceClaimed++;
          const c = commentMap.get(dev.comment);
          if (!c) {
            continue;
          }

          const verification = verifyQuote(dev.quote, c.bodyNorm);
          if (verification.verified) {
            verifiedEvidenceWeight += verification.method === 'fuzzy' ? 0.5 : 1.0;
            hasVerifiedDecisionStatement = true;
            statementAuthorRole = c.authorRole;
          }

          verifiedDecisionEvidence.push({
            commentId: c.id,
            claimType: 'decision_statement',
            quote: dev.quote,
            verification,
            author: c.author,
            authorRole: c.authorRole,
            url: c.url,
          });
        }

        // 2. Verify alternative evidence quotes
        interface VerifiedAltItem {
          alt: (typeof dec.alternatives)[number];
          verifiedEvidence: VerifiedEvidenceItem[];
          hasVerifiedRejectionReason: boolean;
        }

        const verifiedAlternatives: VerifiedAltItem[] = [];
        let rejectedAltsCount = 0;
        let rejectedAltsWithVerifiedReasonCount = 0;

        for (const alt of dec.alternatives) {
          if (alt.outcome === 'rejected') {
            rejectedAltsCount++;
          }

          const altEvidenceList: VerifiedEvidenceItem[] = [];
          let hasVerifiedRejection = false;

          for (const ev of alt.evidence) {
            totalEvidenceClaimed++;
            const c = commentMap.get(ev.comment);
            if (!c) {
              continue;
            }

            const verification = verifyQuote(ev.quote, c.bodyNorm);
            if (verification.verified) {
              verifiedEvidenceWeight += verification.method === 'fuzzy' ? 0.5 : 1.0;
              if (ev.claim === 'rejection_reason') {
                hasVerifiedRejection = true;
              }
            }

            altEvidenceList.push({
              commentId: c.id,
              claimType: ev.claim,
              quote: ev.quote,
              verification,
              author: c.author,
              authorRole: c.authorRole,
              url: c.url,
            });
          }

          if (alt.outcome === 'rejected' && hasVerifiedRejection) {
            rejectedAltsWithVerifiedReasonCount++;
          }

          verifiedAlternatives.push({
            alt,
            verifiedEvidence: altEvidenceList,
            hasVerifiedRejectionReason: hasVerifiedRejection,
          });
        }

        // 3. Evidence Lock Status Enforcement:
        // Section 9 Rule 8: If a decision has zero verified decision_statement evidence,
        // force status to 'unresolved'
        let finalStatus = dec.status;
        if (!hasVerifiedDecisionStatement && finalStatus === 'accepted') {
          finalStatus = 'unresolved';
        }

        // 4. Calculate deterministic confidence
        const { confidence, confidenceParts } = calculateDecisionConfidence({
          verifiedEvidenceWeight,
          totalEvidenceClaimed,
          hasVerifiedDecisionStatement,
          statementAuthorRole,
          rejectedAltsCount,
          rejectedAltsWithVerifiedReasonCount,
        });

        // 5. Insert decision record
        const decInsertRes = insertDecisionStmt.run(
          sourceId,
          runId,
          dec.title,
          finalStatus,
          dec.summary,
          confidence,
          JSON.stringify(confidenceParts),
          now,
          now,
        );

        const decisionId = Number(decInsertRes.lastInsertRowid);
        const storedDecisionEvidence: StoredEvidence[] = [];
        let verifiedCount = 0;
        let unverifiedCount = 0;

        // Insert decision_evidence
        for (const dev of verifiedDecisionEvidence) {
          const evInsert = insertEvidenceStmt.run(
            decisionId,
            null,
            dev.commentId,
            dev.claimType,
            dev.quote,
            dev.verification.verified ? 1 : 0,
            dev.verification.method,
            dev.verification.score,
            dev.verification.matchStart,
            dev.verification.matchEnd,
            now,
          );

          if (dev.verification.verified) verifiedCount++;
          else unverifiedCount++;

          storedDecisionEvidence.push({
            id: Number(evInsert.lastInsertRowid),
            claimType: dev.claimType,
            quote: dev.quote,
            verified: dev.verification.verified,
            method: dev.verification.method,
            score: dev.verification.score,
            commentId: dev.commentId,
            author: dev.author,
            authorRole: dev.authorRole,
            url: dev.url,
          });
        }

        // Insert alternatives, conditions, and evidence
        const storedAlts: StoredAlternative[] = [];
        const altNames: string[] = [];

        for (const valAlt of verifiedAlternatives) {
          const alt = valAlt.alt;
          altNames.push(`${alt.name}: ${alt.description}`);

          const altInsertRes = insertAltStmt.run(
            decisionId,
            alt.name,
            alt.description,
            alt.outcome,
            alt.reason || null,
            alt.reason_category || null,
          );
          const alternativeId = Number(altInsertRes.lastInsertRowid);
          const storedAltEvidence: StoredEvidence[] = [];

          let lastEvidenceId: number | null = null;
          for (const aev of valAlt.verifiedEvidence) {
            const evInsert = insertEvidenceStmt.run(
              decisionId,
              alternativeId,
              aev.commentId,
              aev.claimType,
              aev.quote,
              aev.verification.verified ? 1 : 0,
              aev.verification.method,
              aev.verification.score,
              aev.verification.matchStart,
              aev.verification.matchEnd,
              now,
            );

            const evidenceId = Number(evInsert.lastInsertRowid);
            lastEvidenceId = evidenceId;

            if (aev.verification.verified) verifiedCount++;
            else unverifiedCount++;

            storedAltEvidence.push({
              id: evidenceId,
              claimType: aev.claimType,
              quote: aev.quote,
              verified: aev.verification.verified,
              method: aev.verification.method,
              score: aev.verification.score,
              commentId: aev.commentId,
              author: aev.author,
              authorRole: aev.authorRole,
              url: aev.url,
            });
          }

          // Insert conditions
          for (const cond of alt.conditions) {
            insertConditionStmt.run(
              alternativeId,
              lastEvidenceId,
              cond.text,
              cond.kind,
              cond.probe,
              cond.probe_value || null,
              now,
            );
          }

          storedAlts.push({
            id: alternativeId,
            name: alt.name,
            description: alt.description,
            outcome: alt.outcome,
            reason: alt.reason || null,
            reasonCategory: alt.reason_category || null,
            evidence: storedAltEvidence,
          });
        }

        // Insert events
        for (const evt of dec.events) {
          const c = commentMap.get(evt.comment);
          if (c) {
            insertEventStmt.run(decisionId, c.id, null, evt.event, c.createdAt, c.url);
          }
        }

        storedDecisions.push({
          id: decisionId,
          sourceId,
          runId,
          title: dec.title,
          status: finalStatus,
          summary: dec.summary,
          confidence,
          confidenceParts: JSON.stringify(confidenceParts),
          alternatives: storedAlts,
          decisionEvidence: storedDecisionEvidence,
          verifiedCount,
          unverifiedCount,
        });
      }
    });

    persistTx();

    return storedDecisions;
  }
}
