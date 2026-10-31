import type { Database as DatabaseType } from 'better-sqlite3';
import { GemmaPassAOutputSchema, type GemmaPassALabelItem } from '@decisionvault/shared/gemma';
import type { PassALabel } from '@decisionvault/shared/enums';
import { OllamaClient, OLLAMA_SUPPORTED_MODEL } from '../llm/ollama.js';
import { PASS_A_SYSTEM_PROMPT, PROMPT_VERSION, formatCommentForPrompt } from './prompts.js';

export interface SourceComment {
  id: number;
  sourceId: number;
  idx: number;
  author: string;
  authorRole: string;
  body: string;
  bodyNorm: string;
  url: string;
  createdAt: string;
}

export interface ClassifiedCommentLabel {
  commentId: number;
  threadLocalId: string;
  label: PassALabel;
  altName: string | null;
}

export interface PassAResult {
  labels: ClassifiedCommentLabel[];
  commentMap: Map<string, SourceComment>;
}

export class PassAService {
  constructor(
    private readonly db: DatabaseType,
    private readonly ollamaClient: OllamaClient = new OllamaClient(),
  ) {}

  /**
   * Runs Pass A classification over comments belonging to an imported source.
   */
  public async classifyComments(
    sourceId: number,
    runId: number,
    options: { persist?: boolean } = { persist: true },
  ): Promise<PassAResult> {
    const comments = this.db
      .prepare(
        'SELECT id, source_id as sourceId, idx, author, author_role as authorRole, body, body_norm as bodyNorm, url, created_at as createdAt FROM comments WHERE source_id = ? ORDER BY idx ASC',
      )
      .all(sourceId) as SourceComment[];

    if (!comments.length) {
      return { labels: [], commentMap: new Map() };
    }

    const commentMap = new Map<string, SourceComment>();
    const promptSegments: string[] = [];

    comments.forEach((c, index) => {
      const threadLocalId = `c${index + 1}`;
      commentMap.set(threadLocalId, c);
      promptSegments.push(formatCommentForPrompt(threadLocalId, c.author, c.authorRole, c.body));
    });

    const userPrompt = `Classify the following ${comments.length} comments from discussion #${sourceId}:\n\n${promptSegments.join('\n\n')}`;

    const chatResponse = await this.ollamaClient.chat<{
      labels: GemmaPassALabelItem[];
    }>({
      model: OLLAMA_SUPPORTED_MODEL,
      promptVersion: PROMPT_VERSION,
      systemPrompt: PASS_A_SYSTEM_PROMPT,
      userPrompt,
      schemaHash: 'pass_a_schema_v1',
    });

    // Validate with Zod
    const parsed = GemmaPassAOutputSchema.safeParse(chatResponse.data);
    if (!parsed.success) {
      throw new Error(`Gemma Pass A output failed schema validation: ${parsed.error.message}`);
    }

    const classifiedLabels: ClassifiedCommentLabel[] = [];
    for (const item of parsed.data.labels) {
      const comment = commentMap.get(item.comment);
      if (!comment) {
        // Ignore hallucinated comment IDs not in this source
        continue;
      }

      const altName = item.alternative?.trim() || null;
      classifiedLabels.push({
        commentId: comment.id,
        threadLocalId: item.comment,
        label: item.label,
        altName,
      });
    }

    if (options.persist !== false) {
      const insertStmt = this.db.prepare(
        `INSERT INTO labels (comment_id, run_id, label, alt_name)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(comment_id, run_id) DO UPDATE SET
           label = excluded.label,
           alt_name = excluded.alt_name`,
      );

      const persistTx = this.db.transaction(() => {
        for (const l of classifiedLabels) {
          insertStmt.run(l.commentId, runId, l.label, l.altName);
        }
      });

      persistTx();
    }

    return {
      labels: classifiedLabels,
      commentMap,
    };
  }
}
