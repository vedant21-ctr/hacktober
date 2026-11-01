import type { Database } from 'better-sqlite3';
import { getDatabase } from '../db/index.js';
import { extractFilePaths } from '../link/service.js';
import type { AskResponse, Evidence } from '@decisionvault/shared/api';
import { AskResponseSchema } from '@decisionvault/shared/api';

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'what',
  'when',
  'where',
  'which',
  'why',
  'how',
  'who',
  'was',
  'were',
  'been',
  'are',
  'did',
  'does',
  'have',
  'has',
  'had',
  'about',
  'there',
  'their',
  'into',
  'should',
  'would',
  'could',
  'please',
  'tell',
]);

export class AskService {
  /**
   * Performs grounded decision retrieval and answers questions strictly
   * based on historical decisions and verified evidence.
   */
  public async ask(
    repoId: number,
    question: string,
    customDb?: Database,
  ): Promise<AskResponse | null> {
    const db = customDb || getDatabase();

    // Verify repository exists
    const repoRow = db.prepare('SELECT id, full_name FROM repositories WHERE id = ?').get(repoId);
    if (!repoRow) {
      return null;
    }

    const trimmedQ = question.trim();
    if (!trimmedQ) {
      return {
        answer: 'No relevant engineering decision was found in the available repository history.',
        insufficientEvidence: true,
        citations: [],
      };
    }

    // 1. Extract potential file path mentions in the question
    const mentionedPaths = extractFilePaths(trimmedQ);

    // 2. Extract significant search tokens
    const tokens = trimmedQ
      .toLowerCase()
      .replace(/[^a-z0-9_\-\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

    // Candidates map: decisionId -> { decisionRow, score }
    const candidates = new Map<
      number,
      {
        id: number;
        title: string;
        status: string;
        lifecycle: string;
        summary: string;
        confidence: number;
        sourceUrl: string;
        sourceTitle: string;
        score: number;
      }
    >();

    // Strategy A: Search by mentioned file paths
    for (const filePath of mentionedPaths) {
      const pathRows = db
        .prepare(
          `SELECT DISTINCT d.id, d.title, d.status, d.lifecycle, d.summary, d.confidence,
                  s.url as source_url, s.title as source_title
           FROM decision_files df
           JOIN decisions d ON df.decision_id = d.id
           JOIN sources s ON d.source_id = s.id
           WHERE (df.path = ? OR df.current_path = ?)
             AND s.repo_id = ?`,
        )
        .all(filePath, filePath, repoId) as Array<{
        id: number;
        title: string;
        status: string;
        lifecycle: string;
        summary: string;
        confidence: number;
        source_url: string;
        source_title: string;
      }>;

      for (const r of pathRows) {
        const existing = candidates.get(r.id);
        if (existing) {
          existing.score += 10;
        } else {
          candidates.set(r.id, {
            id: r.id,
            title: r.title,
            status: r.status,
            lifecycle: r.lifecycle,
            summary: r.summary,
            confidence: r.confidence,
            sourceUrl: r.source_url,
            sourceTitle: r.source_title,
            score: 10,
          });
        }
      }
    }

    // Strategy B: Search FTS5 and LIKE queries on decisions within repoId
    if (tokens.length > 0) {
      const ftsTerm = tokens.map((t) => `"${t}"`).join(' OR ');
      let ftsFound = false;
      try {
        const ftsRows = db
          .prepare(
            `SELECT d.id, d.title, d.status, d.lifecycle, d.summary, d.confidence,
                    s.url as source_url, s.title as source_title
             FROM decisions d
             JOIN sources s ON d.source_id = s.id
             WHERE s.repo_id = ?
               AND d.id IN (SELECT rowid FROM decisions_fts WHERE decisions_fts MATCH ?)`,
          )
          .all(repoId, ftsTerm) as Array<{
          id: number;
          title: string;
          status: string;
          lifecycle: string;
          summary: string;
          confidence: number;
          source_url: string;
          source_title: string;
        }>;

        if (ftsRows.length > 0) {
          ftsFound = true;
          for (const r of ftsRows) {
            const existing = candidates.get(r.id);
            if (existing) {
              existing.score += 5;
            } else {
              candidates.set(r.id, {
                id: r.id,
                title: r.title,
                status: r.status,
                lifecycle: r.lifecycle,
                summary: r.summary,
                confidence: r.confidence,
                sourceUrl: r.source_url,
                sourceTitle: r.source_title,
                score: 5,
              });
            }
          }
        }
      } catch {
        // Ignore FTS errors and fallback
      }

      if (!ftsFound) {
        // Fallback to LIKE
        for (const token of tokens) {
          const likeRows = db
            .prepare(
              `SELECT d.id, d.title, d.status, d.lifecycle, d.summary, d.confidence,
                      s.url as source_url, s.title as source_title
               FROM decisions d
               JOIN sources s ON d.source_id = s.id
               WHERE s.repo_id = ?
                 AND (d.title LIKE ? OR d.summary LIKE ?)`,
            )
            .all(repoId, `%${token}%`, `%${token}%`) as Array<{
            id: number;
            title: string;
            status: string;
            lifecycle: string;
            summary: string;
            confidence: number;
            source_url: string;
            source_title: string;
          }>;

          for (const r of likeRows) {
            const existing = candidates.get(r.id);
            if (existing) {
              existing.score += 2;
            } else {
              candidates.set(r.id, {
                id: r.id,
                title: r.title,
                status: r.status,
                lifecycle: r.lifecycle,
                summary: r.summary,
                confidence: r.confidence,
                sourceUrl: r.source_url,
                sourceTitle: r.source_title,
                score: 2,
              });
            }
          }
        }
      }
    }

    // Strategy C: Search evidence quotes directly for tokens
    for (const token of tokens) {
      const evMatches = db
        .prepare(
          `SELECT DISTINCT d.id, d.title, d.status, d.lifecycle, d.summary, d.confidence,
                  s.url as source_url, s.title as source_title
           FROM evidence e
           JOIN decisions d ON e.decision_id = d.id
           JOIN sources s ON d.source_id = s.id
           WHERE s.repo_id = ?
             AND e.verified = 1
             AND e.quote LIKE ?`,
        )
        .all(repoId, `%${token}%`) as Array<{
        id: number;
        title: string;
        status: string;
        lifecycle: string;
        summary: string;
        confidence: number;
        source_url: string;
        source_title: string;
      }>;

      for (const r of evMatches) {
        const existing = candidates.get(r.id);
        if (existing) {
          existing.score += 4;
        } else {
          candidates.set(r.id, {
            id: r.id,
            title: r.title,
            status: r.status,
            lifecycle: r.lifecycle,
            summary: r.summary,
            confidence: r.confidence,
            sourceUrl: r.source_url,
            sourceTitle: r.source_title,
            score: 4,
          });
        }
      }
    }

    // Sort candidates by score descending
    const sortedCandidates = Array.from(candidates.values()).sort((a, b) => b.score - a.score);

    // Fetch verified evidence for top candidate decisions
    const evidenceStmt = db.prepare(
      `SELECT e.id, e.quote, e.claim_type, e.verified, e.verification_method,
              e.match_score, e.created_at,
              c.author, c.author_role, c.url
       FROM evidence e
       JOIN comments c ON e.comment_id = c.id
       WHERE e.decision_id = ? AND e.verified = 1
       ORDER BY e.id ASC`,
    );

    const altStmt = db.prepare(
      `SELECT id, name, description, outcome, reason, reason_category
       FROM alternatives
       WHERE decision_id = ?
       ORDER BY id ASC`,
    );

    const citations: Array<{ decisionId: number; evidence: Evidence }> = [];
    const answerFragments: string[] = [];

    for (const cand of sortedCandidates.slice(0, 3)) {
      const evRows = evidenceStmt.all(cand.id) as Array<{
        id: number;
        quote: string;
        claim_type: any;
        verified: number;
        verification_method: any;
        match_score: number;
        created_at: string;
        author: string;
        author_role: string;
        url: string;
      }>;

      const altRows = altStmt.all(cand.id) as Array<{
        id: number;
        name: string;
        description: string;
        outcome: string;
        reason: string | null;
        reason_category: string | null;
      }>;

      // Collect citations
      for (const ev of evRows) {
        citations.push({
          decisionId: cand.id,
          evidence: {
            id: ev.id,
            quote: ev.quote,
            claimType: ev.claim_type,
            verified: ev.verified === 1,
            method: ev.verification_method,
            score: ev.match_score,
            author: ev.author,
            role: ev.author_role,
            at: new Date(ev.created_at).toISOString(),
            url: ev.url,
          },
        });
      }

      // Synthesize grounded fragment
      let fragment = `Decision #${cand.id} ("${cand.title}", ${cand.status}) established: ${cand.summary}`;

      const primaryQuote = evRows[0]?.quote;
      if (primaryQuote) {
        fragment += ` Grounded evidence from ${evRows[0].author} (${evRows[0].author_role}): "${primaryQuote}"`;
      }

      const rejectedAlts = altRows.filter((a) => a.outcome === 'rejected');
      if (rejectedAlts.length > 0) {
        const altDetails = rejectedAlts
          .map((a) => `"${a.name}" (rejected because ${a.reason || a.description})`)
          .join(', ');
        fragment += ` Considered and rejected alternatives: ${altDetails}.`;
      }

      if (cand.lifecycle === 'superseded') {
        fragment += ` Note: this decision has been superseded in repository history.`;
      }

      answerFragments.push(fragment);
    }

    // If no citations or candidates found, return insufficient evidence response
    if (citations.length === 0 || answerFragments.length === 0) {
      return {
        answer: 'No relevant engineering decision was found in the available repository history.',
        insufficientEvidence: true,
        citations: [],
      };
    }

    const answer = answerFragments.join('\n\n');
    const result: AskResponse = {
      answer,
      insufficientEvidence: false,
      citations,
    };

    return AskResponseSchema.parse(result);
  }
}

export const askService = new AskService();
