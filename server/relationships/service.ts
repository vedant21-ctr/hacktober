import type { Database } from 'better-sqlite3';
import { getDatabase } from '../db/index.js';
import type {
  RelationshipsResponse,
  RelationshipItem,
  DecisionCard,
  Evidence,
} from '@decisionvault/shared/api';
import { RelationshipsResponseSchema } from '@decisionvault/shared/api';
import type { RelationType } from '@decisionvault/shared/enums';

export class RelationshipsService {
  /**
   * Retrieves all verified relationships for a given decision.
   */
  public getRelationships(decisionId: number, customDb?: Database): RelationshipsResponse | null {
    const db = customDb || getDatabase();

    const decExists = db.prepare('SELECT id FROM decisions WHERE id = ?').get(decisionId);
    if (!decExists) {
      return null;
    }

    const rows = db
      .prepare(
        `SELECT dr.id, dr.relationship_type, dr.source_decision_id, dr.target_decision_id,
                dr.evidence_id,
                d.id as other_id, d.title as other_title, d.status as other_status,
                d.lifecycle as other_lifecycle, d.summary as other_summary,
                d.confidence as other_confidence,
                s.url as other_source_url, s.title as other_source_title,
                e.id as ev_id, e.quote as ev_quote, e.claim_type as ev_claim_type,
                e.verified as ev_verified, e.verification_method as ev_method,
                e.match_score as ev_score, e.created_at as ev_created_at,
                c.author as ev_author, c.author_role as ev_role, c.url as ev_url
         FROM decision_relationships dr
         JOIN decisions d ON (CASE WHEN dr.source_decision_id = ? THEN dr.target_decision_id ELSE dr.source_decision_id END) = d.id
         JOIN sources s ON d.source_id = s.id
         JOIN evidence e ON dr.evidence_id = e.id
         JOIN comments c ON e.comment_id = c.id
         WHERE dr.source_decision_id = ? OR dr.target_decision_id = ?
         ORDER BY dr.id ASC`,
      )
      .all(decisionId, decisionId, decisionId) as Array<{
      id: number;
      relationship_type: RelationType;
      source_decision_id: number;
      target_decision_id: number;
      evidence_id: number;
      other_id: number;
      other_title: string;
      other_status: any;
      other_lifecycle: any;
      other_summary: string;
      other_confidence: number;
      other_source_url: string;
      other_source_title: string;
      ev_id: number;
      ev_quote: string;
      ev_claim_type: any;
      ev_verified: number;
      ev_method: any;
      ev_score: number;
      ev_created_at: string;
      ev_author: string;
      ev_role: string;
      ev_url: string;
    }>;

    const evRatioStmt = db.prepare(
      `SELECT SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as vCount, COUNT(*) as tCount
       FROM evidence WHERE decision_id = ?`,
    );

    const items: RelationshipItem[] = [];

    for (const r of rows) {
      const stats = evRatioStmt.get(r.other_id) as { vCount: number; tCount: number } | undefined;
      const vCount = stats?.vCount || 0;
      const tCount = stats?.tCount || 0;
      const verifiedRatio = tCount > 0 ? Math.round((vCount / tCount) * 100) / 100 : 0;

      const otherDecision: DecisionCard = {
        id: r.other_id,
        title: r.other_title,
        status: r.other_status,
        lifecycle: r.other_lifecycle,
        summary: r.other_summary,
        confidence: r.other_confidence,
        sourceUrl: r.other_source_url,
        sourceTitle: r.other_source_title,
        verifiedRatio,
      };

      const evidence: Evidence = {
        id: r.ev_id,
        quote: r.ev_quote,
        claimType: r.ev_claim_type,
        verified: r.ev_verified === 1,
        method: r.ev_method,
        score: r.ev_score,
        author: r.ev_author,
        role: r.ev_role,
        at: new Date(r.ev_created_at).toISOString(),
        url: r.ev_url,
      };

      items.push({
        type: r.relationship_type,
        otherDecision,
        evidence,
      });
    }

    return RelationshipsResponseSchema.parse({ items });
  }
}

export const relationshipsService = new RelationshipsService();
