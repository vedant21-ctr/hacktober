import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import { getDatabase } from '../db/index.js';
import { normalizeFilePath, extractFilePaths } from '../link/service.js';
import type {
  PriorArtReport,
  PriorArtItem,
  DecisionCard,
  Evidence,
  Condition,
} from '@decisionvault/shared/api';
import { PriorArtReportSchema } from '@decisionvault/shared/api';
import type { PriorArtInputType, PriorArtRelation } from '@decisionvault/shared/enums';

/**
 * Common English and code stop words to exclude when extracting concepts.
 */
const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'module',
  'import',
  'function',
  'return',
  'class',
  'const',
  'file',
  'files',
  'code',
  'change',
  'changes',
  'update',
  'test',
  'tests',
  'diff',
  'git',
  'into',
  'should',
  'have',
  'been',
  'what',
  'when',
  'where',
  'which',
  'their',
  'about',
  'would',
  'there',
]);

/**
 * Parses user input (idea, pr, or diff) into structured changed file paths,
 * detected concepts, and a clean summary description.
 */
export function parsePriorArtInput(
  type: PriorArtInputType,
  value: string,
): { summary: string; changedPaths: string[]; concepts: string[] } {
  if (!value || typeof value !== 'string') {
    return { summary: '', changedPaths: [], concepts: [] };
  }

  const raw = value.trim();
  const foundPaths = new Set<string>();
  let summary = '';

  // 1. Check if input is structured JSON
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.summary === 'string') {
        summary = parsed.summary.trim();
      } else if (typeof parsed.title === 'string') {
        summary = parsed.title.trim();
      }

      if (Array.isArray(parsed.files)) {
        for (const f of parsed.files) {
          const norm = normalizeFilePath(String(f));
          if (norm) foundPaths.add(norm);
        }
      }
    } catch {
      // Continue with text parsing
    }
  }

  // 2. Extract paths from unified diff headers
  if (
    type === 'diff' ||
    raw.includes('diff --git') ||
    raw.includes('--- ') ||
    raw.includes('+++ ')
  ) {
    const diffRegex =
      /(?:diff --git a\/(.+?) b\/.+?|--- (?:a\/)?([^\s\t\r\n]+)|\+\+\+ (?:b\/)?([^\s\t\r\n]+))/g;
    let match: RegExpExecArray | null;
    while ((match = diffRegex.exec(raw)) !== null) {
      const candidate = match[1] || match[2] || match[3];
      if (candidate && candidate !== '/dev/null') {
        const norm = normalizeFilePath(candidate);
        if (norm) foundPaths.add(norm);
      }
    }
  }

  // 3. Extract paths using extractFilePaths()
  const extracted = extractFilePaths(raw);
  for (const p of extracted) {
    foundPaths.add(p);
  }

  // 4. Extract line-separated or comma-separated paths
  const lines = raw.split(/[\r\n,]+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const norm = normalizeFilePath(trimmed);
    if (norm) foundPaths.add(norm);
  }

  // 5. Build summary if not already established
  if (!summary) {
    const firstNonEmptyLine =
      lines
        .map((l) => l.trim())
        .find(
          (l) =>
            l.length > 0 && !l.startsWith('diff') && !l.startsWith('---') && !l.startsWith('+++'),
        ) || raw.slice(0, 100);
    summary =
      firstNonEmptyLine.length > 120 ? `${firstNonEmptyLine.slice(0, 117)}...` : firstNonEmptyLine;
  }

  // 6. Extract key concepts
  const conceptSet = new Set<string>();
  const tokens = raw.match(/[a-zA-Z0-9_\-]{3,}/g) || [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (!STOP_WORDS.has(lower) && !/^\d+$/.test(lower) && !lower.includes('/')) {
      conceptSet.add(lower);
    }
  }

  // Limit to top 8 distinct concepts
  const concepts = Array.from(conceptSet).slice(0, 8);
  const changedPaths = Array.from(foundPaths);

  return { summary, changedPaths, concepts };
}

export class PriorArtService {
  private reports = new Map<number, PriorArtReport>();
  private nextReportId = 1;

  /**
   * Runs grounded prior-art analysis against historical decisions and verified evidence.
   */
  public async runPriorArtAnalysis(
    repoId: number,
    input: { type: PriorArtInputType; value: string },
    reportId?: number,
    customDb?: Database,
  ): Promise<PriorArtReport> {
    const db = customDb || getDatabase();
    const id = reportId || this.nextReportId++;

    const { summary, changedPaths, concepts } = parsePriorArtInput(input.type, input.value);

    // Candidates map: decisionId -> { decisionRow, matchedPaths: Set<string>, fileLinks: any[] }
    const candidateDecisions = new Map<
      number,
      {
        id: number;
        title: string;
        status: any;
        lifecycle: any;
        summary: string;
        confidence: number;
        source_url: string;
        source_title: string;
        matchedPaths: Set<string>;
        fileLinks: Array<{
          path: string;
          current_path: string | null;
          link_kind: string;
          basis: string;
          evidence_id: number | null;
        }>;
      }
    >();

    // Step 1: Find decisions associated with any of the changed paths within repoId
    for (const filePath of changedPaths) {
      const rows = db
        .prepare(
          `SELECT DISTINCT
             d.id, d.title, d.status, d.lifecycle, d.summary, d.confidence,
             s.url as source_url, s.title as source_title,
             df.path as file_path, df.current_path as file_current_path,
             df.link_kind as file_link_kind, df.basis as file_basis,
             df.evidence_id as file_evidence_id
           FROM decision_files df
           JOIN decisions d ON df.decision_id = d.id
           JOIN sources s ON d.source_id = s.id
           WHERE (df.path = ? OR df.current_path = ?)
             AND s.repo_id = ?`,
        )
        .all(filePath, filePath, repoId) as Array<{
        id: number;
        title: string;
        status: any;
        lifecycle: any;
        summary: string;
        confidence: number;
        source_url: string;
        source_title: string;
        file_path: string;
        file_current_path: string | null;
        file_link_kind: string;
        file_basis: string;
        file_evidence_id: number | null;
      }>;

      for (const r of rows) {
        let entry = candidateDecisions.get(r.id);
        if (!entry) {
          entry = {
            id: r.id,
            title: r.title,
            status: r.status,
            lifecycle: r.lifecycle,
            summary: r.summary,
            confidence: r.confidence,
            source_url: r.source_url,
            source_title: r.source_title,
            matchedPaths: new Set<string>(),
            fileLinks: [],
          };
          candidateDecisions.set(r.id, entry);
        }
        entry.matchedPaths.add(filePath);
        entry.fileLinks.push({
          path: r.file_path,
          current_path: r.file_current_path,
          link_kind: r.file_link_kind,
          basis: r.file_basis,
          evidence_id: r.file_evidence_id,
        });
      }
    }

    // Step 2: If changedPaths yielded few decisions or input has rich concepts, search decisions via FTS5
    if (candidateDecisions.size < 5 && concepts.length > 0) {
      const safeTerms = concepts
        .map((c) => c.replace(/[^a-zA-Z0-9_-]/g, ''))
        .filter((c) => c.length >= 3);

      if (safeTerms.length > 0) {
        try {
          const ftsQuery = safeTerms.map((t) => `"${t}"`).join(' OR ');
          const ftsRows = db
            .prepare(
              `SELECT d.id, d.title, d.status, d.lifecycle, d.summary, d.confidence,
                      s.url as source_url, s.title as source_title
               FROM decisions d
               JOIN sources s ON d.source_id = s.id
               WHERE s.repo_id = ?
                 AND d.id IN (SELECT rowid FROM decisions_fts WHERE decisions_fts MATCH ?)
               LIMIT 5`,
            )
            .all(repoId, ftsQuery) as Array<{
            id: number;
            title: string;
            status: any;
            lifecycle: any;
            summary: string;
            confidence: number;
            source_url: string;
            source_title: string;
          }>;

          for (const r of ftsRows) {
            if (!candidateDecisions.has(r.id)) {
              candidateDecisions.set(r.id, {
                id: r.id,
                title: r.title,
                status: r.status,
                lifecycle: r.lifecycle,
                summary: r.summary,
                confidence: r.confidence,
                source_url: r.source_url,
                source_title: r.source_title,
                matchedPaths: new Set<string>(),
                fileLinks: [],
              });
            }
          }
        } catch {
          // Non-fatal if FTS query syntax error
        }
      }
    }

    // Step 3: Hydrate each candidate decision into a PriorArtItem
    const evRatioStmt = db.prepare(
      `SELECT SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as vCount, COUNT(*) as tCount
       FROM evidence WHERE decision_id = ?`,
    );

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

    const condStmt = db.prepare(
      `SELECT id, text, kind, probe, probe_value
       FROM conditions
       WHERE alternative_id = ?
       ORDER BY id ASC`,
    );

    const items: PriorArtItem[] = [];

    for (const cand of candidateDecisions.values()) {
      // 1. Evidence ratio
      const evStats = evRatioStmt.get(cand.id) as { vCount: number; tCount: number } | undefined;
      const vCount = evStats?.vCount || 0;
      const tCount = evStats?.tCount || 0;
      const verifiedRatio = tCount > 0 ? Math.round((vCount / tCount) * 100) / 100 : 0;

      const decisionCard: DecisionCard = {
        id: cand.id,
        title: cand.title,
        status: cand.status,
        lifecycle: cand.lifecycle,
        summary: cand.summary,
        confidence: cand.confidence,
        sourceUrl: cand.source_url,
        sourceTitle: cand.source_title,
        verifiedRatio,
      };

      // 2. Verified evidence
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

      const evidenceList: Evidence[] = evRows.map((e) => ({
        id: e.id,
        quote: e.quote,
        claimType: e.claim_type,
        verified: e.verified === 1,
        method: e.verification_method,
        score: e.match_score,
        author: e.author,
        role: e.author_role,
        at: new Date(e.created_at).toISOString(),
        url: e.url,
      }));

      // 3. Alternatives & Conditions
      const altRows = altStmt.all(cand.id) as Array<{
        id: number;
        name: string;
        description: string;
        outcome: any;
        reason: string | null;
        reason_category: any;
      }>;

      const allConditions: Condition[] = [];
      let rejectedBecause: string | null = null;
      let matchingRejectedAlt: (typeof altRows)[0] | null = null;

      for (const a of altRows) {
        const cRows = condStmt.all(a.id) as Array<{
          id: number;
          text: string;
          kind: any;
          probe: any;
          probe_value: string | null;
        }>;

        for (const c of cRows) {
          allConditions.push({
            id: c.id,
            text: c.text,
            kind: c.kind,
            probe: c.probe,
            probeValue: c.probe_value,
            health: null,
          });
        }

        if (a.outcome === 'rejected') {
          rejectedBecause = a.reason || a.description;
          matchingRejectedAlt = a;
        }
      }

      // 4. Grounded conflict vs related evaluation
      let relation: PriorArtRelation = 'related';
      let reason = '';
      let reconsiderIf = '';

      const isDeletedInHistory = cand.fileLinks.some((l) => l.current_path === null);
      const hasVerifiedQuote = cand.fileLinks.some((l) => l.evidence_id !== null);
      const isDeprecationDecision =
        /deprecat|remov|drop|delet|dead-batter|supersed/i.test(cand.title) ||
        /deprecat|remov|drop|delet|dead-batter|supersed/i.test(cand.summary);

      if (isDeletedInHistory) {
        relation = 'conflicts';
        reason = `Direct conflict: modified file was deprecated or removed by accepted decision "${cand.title}".`;
        reconsiderIf =
          allConditions.length > 0
            ? `Reconsider only if condition holds: ${allConditions.map((c) => c.text).join('; ')}`
            : 'Reconsider if maintenance ownership and modern dependencies are established.';
      } else if (matchingRejectedAlt) {
        relation = 'conflicts';
        reason = `Potential conflict with previously rejected alternative "${matchingRejectedAlt.name}" under decision "${cand.title}".`;
        reconsiderIf =
          allConditions.length > 0
            ? `Reconsider if constraints change: ${allConditions.map((c) => c.text).join('; ')}`
            : 'Reconsider if technical requirements or project architecture have changed.';
      } else if (isDeprecationDecision) {
        relation = 'conflicts';
        reason = `Potential architectural conflict with decision "${cand.title}": ${cand.summary}`;
        reconsiderIf =
          'Reconsider if upstream ecosystem or project maintenance mandate is revised.';
      } else {
        relation = 'related';
        const fileNames = Array.from(cand.matchedPaths).join(', ');
        reason = fileNames
          ? `Historical engineering decision governing ${fileNames}: "${cand.title}".`
          : `Related architectural decision: "${cand.title}".`;
        reconsiderIf = 'Review existing conventions and architecture constraints prior to merging.';
      }

      // Append attribution grounding
      if (hasVerifiedQuote) {
        reason += ' Grounded by direct verified evidence quote.';
      } else if (cand.matchedPaths.size > 0) {
        reason += ' Grounded via repository file mapping.';
      } else {
        reason += ' Matched via architectural concept search.';
      }

      items.push({
        decision: decisionCard,
        relation,
        reason,
        evidence: evidenceList,
        rejectedBecause,
        conditions: allConditions,
        reconsiderIf,
      });
    }

    // Sort items: conflicts first, then related, then irrelevant; within group by confidence DESC
    const relationOrder: Record<PriorArtRelation, number> = {
      conflicts: 1,
      related: 2,
      irrelevant: 3,
    };

    items.sort((a, b) => {
      const orderA = relationOrder[a.relation] || 9;
      const orderB = relationOrder[b.relation] || 9;
      if (orderA !== orderB) return orderA - orderB;
      return b.decision.confidence - a.decision.confidence;
    });

    const note =
      items.length > 0
        ? `Prior-art detection grounded in ${items.length} historical repository decisions and verified evidence quotes.`
        : 'No conflicting or related historical decisions were found for the specified changed files or concepts in this repository.';

    const report: PriorArtReport = {
      id,
      input: {
        type: input.type,
        summary: summary || 'Simulated pull request analysis',
      },
      concepts,
      changedPaths,
      items,
      note,
    };

    const validated = PriorArtReportSchema.parse(report);
    this.reports.set(id, validated);
    return validated;
  }

  public getReport(id: number): PriorArtReport | undefined {
    return this.reports.get(id);
  }

  public setReport(id: number, report: PriorArtReport): void {
    this.reports.set(id, report);
  }

  public clear(): void {
    this.reports.clear();
    this.nextReportId = 1;
  }
}

export const priorArtService = new PriorArtService();
