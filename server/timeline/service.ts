import type { Database } from 'better-sqlite3';
import { getDatabase } from '../db/index.js';
import type { TimelineResponse, TimelineEvent } from '@decisionvault/shared/api';
import { TimelineResponseSchema } from '@decisionvault/shared/api';

export class TimelineService {
  /**
   * Retrieves the chronological event history for a given decision.
   */
  public getTimeline(decisionId: number, customDb?: Database): TimelineResponse | null {
    const db = customDb || getDatabase();

    const decRow = db
      .prepare(
        `SELECT d.id, d.title, d.status, d.source_id,
                s.url as source_url, s.title as source_title, s.created_at as source_created_at
         FROM decisions d
         JOIN sources s ON d.source_id = s.id
         WHERE d.id = ?`,
      )
      .get(decisionId) as
      | {
          id: number;
          title: string;
          status: string;
          source_id: number;
          source_url: string;
          source_title: string;
          source_created_at: string | null;
        }
      | undefined;

    if (!decRow) {
      return null;
    }

    // 1. Check for stored decision_events rows
    const storedEvents = db
      .prepare(
        `SELECT de.id, de.event_type, de.occurred_at, de.source_url,
                c.author, c.author_role,
                e.quote, e.verified
         FROM decision_events de
         JOIN comments c ON de.comment_id = c.id
         LEFT JOIN evidence e ON de.evidence_id = e.id
         WHERE de.decision_id = ?
         ORDER BY de.occurred_at ASC`,
      )
      .all(decisionId) as Array<{
      id: number;
      event_type: string;
      occurred_at: string;
      source_url: string;
      author: string;
      author_role: string;
      quote: string | null;
      verified: number | null;
    }>;

    if (storedEvents.length > 0) {
      const events: TimelineEvent[] = storedEvents.map((ev) => ({
        type: ev.event_type,
        at: new Date(ev.occurred_at).toISOString(),
        author: ev.author,
        role: ev.author_role,
        quote: ev.quote || null,
        sourceUrl: ev.source_url,
        verified: ev.verified === 1,
      }));

      return TimelineResponseSchema.parse({ events });
    }

    // 2. Synthesize chronological events from evidence and comments
    const evidenceRows = db
      .prepare(
        `SELECT e.id, e.quote, e.claim_type, e.verified, e.created_at,
                c.author, c.author_role, c.url
         FROM evidence e
         JOIN comments c ON e.comment_id = c.id
         WHERE e.decision_id = ?
         ORDER BY c.created_at ASC, e.id ASC`,
      )
      .all(decisionId) as Array<{
      id: number;
      quote: string;
      claim_type: string;
      verified: number;
      created_at: string;
      author: string;
      author_role: string;
      url: string;
    }>;

    const events: TimelineEvent[] = [];

    // Initial proposal event from source creation if available
    if (decRow.source_created_at) {
      events.push({
        type: 'proposed',
        at: new Date(decRow.source_created_at).toISOString(),
        author: 'maintainers',
        role: 'owner',
        quote: `Initial proposal for discussion: ${decRow.source_title}`,
        sourceUrl: decRow.source_url,
        verified: true,
      });
    }

    for (const ev of evidenceRows) {
      let eventType = 'decided';
      if (ev.claim_type === 'proposal') {
        eventType = 'proposed';
      } else if (ev.claim_type === 'objection' || ev.claim_type === 'rejection_reason') {
        eventType = 'objected';
      } else if (ev.claim_type === 'support') {
        eventType = 'agreed';
      } else if (ev.claim_type === 'revision') {
        eventType = 'revised';
      } else if (ev.claim_type === 'decision_statement') {
        eventType = 'decided';
      }

      events.push({
        type: eventType,
        at: new Date(ev.created_at).toISOString(),
        author: ev.author,
        role: ev.author_role,
        quote: ev.quote,
        sourceUrl: ev.url,
        verified: ev.verified === 1,
      });
    }

    // Sort chronologically
    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return TimelineResponseSchema.parse({ events });
  }
}

export const timelineService = new TimelineService();
