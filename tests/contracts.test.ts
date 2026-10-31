import * as sharedBarrel from '../shared/index.js';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ApiErrorSchema,
  AskResponseSchema,
  BenchmarkCasesResponseSchema,
  BenchmarkConfirmResponseSchema,
  BenchmarkRunAcceptedResponseSchema,
  BenchmarkRunSchema,
  CodeTreeResponseSchema,
  CodeWhyResponseSchema,
  DecisionDetailSchema,
  DecisionsResponseSchema,
  JobAcceptedResponseSchema,
  JobSchema,
  OverviewResponseSchema,
  PriorArtReportSchema,
  RadarResponseSchema,
  RelationshipsResponseSchema,
  RepositoriesResponseSchema,
  SourceDetailResponseSchema,
  StatusResponseSchema,
  TimelineResponseSchema,
} from '@decisionvault/shared/api';

import { GemmaPassAOutputSchema, GemmaPassBOutputSchema } from '@decisionvault/shared/gemma';

import * as SharedModule from '@decisionvault/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../shared/fixtures/api');

function loadFixture(filename: string): unknown {
  const filePath = path.join(fixturesDir, filename);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

describe('API Contract Fixtures', () => {
  it('validates status.json', () => {
    const data = loadFixture('status.json');
    expect(() => StatusResponseSchema.parse(data)).not.toThrow();
  });

  it('validates import_accepted.json', () => {
    const data = loadFixture('import_accepted.json');
    expect(() => JobAcceptedResponseSchema.parse(data)).not.toThrow();
  });

  it('validates extract_accepted.json', () => {
    const data = loadFixture('extract_accepted.json');
    expect(() => JobAcceptedResponseSchema.parse(data)).not.toThrow();
  });

  it('validates job_detail.json', () => {
    const data = loadFixture('job_detail.json');
    expect(() => JobSchema.parse(data)).not.toThrow();
  });

  it('validates repositories.json', () => {
    const data = loadFixture('repositories.json');
    expect(() => RepositoriesResponseSchema.parse(data)).not.toThrow();
  });

  it('validates overview.json', () => {
    const data = loadFixture('overview.json');
    expect(() => OverviewResponseSchema.parse(data)).not.toThrow();
  });

  it('validates decisions_list.json', () => {
    const data = loadFixture('decisions_list.json');
    expect(() => DecisionsResponseSchema.parse(data)).not.toThrow();
  });

  it('validates decision_detail.json', () => {
    const data = loadFixture('decision_detail.json');
    expect(() => DecisionDetailSchema.parse(data)).not.toThrow();
  });

  it('validates source_detail.json', () => {
    const data = loadFixture('source_detail.json');
    expect(() => SourceDetailResponseSchema.parse(data)).not.toThrow();
  });

  it('validates ask_response.json', () => {
    const data = loadFixture('ask_response.json');
    expect(() => AskResponseSchema.parse(data)).not.toThrow();
  });

  it('validates code_tree.json', () => {
    const data = loadFixture('code_tree.json');
    expect(() => CodeTreeResponseSchema.parse(data)).not.toThrow();
  });

  it('validates code_why.json', () => {
    const data = loadFixture('code_why.json');
    expect(() => CodeWhyResponseSchema.parse(data)).not.toThrow();
  });

  it('validates radar.json', () => {
    const data = loadFixture('radar.json');
    expect(() => RadarResponseSchema.parse(data)).not.toThrow();
  });

  it('validates radar_recheck_accepted.json', () => {
    const data = loadFixture('radar_recheck_accepted.json');
    expect(() => JobAcceptedResponseSchema.parse(data)).not.toThrow();
  });

  it('validates timeline.json', () => {
    const data = loadFixture('timeline.json');
    expect(() => TimelineResponseSchema.parse(data)).not.toThrow();
  });

  it('validates relationships.json', () => {
    const data = loadFixture('relationships.json');
    expect(() => RelationshipsResponseSchema.parse(data)).not.toThrow();
  });

  it('validates prior_art_accepted.json', () => {
    const data = loadFixture('prior_art_accepted.json');
    expect(() => JobAcceptedResponseSchema.parse(data)).not.toThrow();
  });

  it('validates prior_art_report.json', () => {
    const data = loadFixture('prior_art_report.json');
    expect(() => PriorArtReportSchema.parse(data)).not.toThrow();
  });

  it('validates benchmark_cases.json', () => {
    const data = loadFixture('benchmark_cases.json');
    expect(() => BenchmarkCasesResponseSchema.parse(data)).not.toThrow();
  });

  it('validates benchmark_run_accepted.json', () => {
    const data = loadFixture('benchmark_run_accepted.json');
    expect(() => BenchmarkRunAcceptedResponseSchema.parse(data)).not.toThrow();
  });

  it('validates benchmark_run_detail.json', () => {
    const data = loadFixture('benchmark_run_detail.json');
    expect(() => BenchmarkRunSchema.parse(data)).not.toThrow();
  });

  it('validates benchmark_confirm_response.json', () => {
    const data = loadFixture('benchmark_confirm_response.json');
    expect(() => BenchmarkConfirmResponseSchema.parse(data)).not.toThrow();
  });

  it('validates error_not_implemented.json', () => {
    const data = loadFixture('error_not_implemented.json');
    expect(() => ApiErrorSchema.parse(data)).not.toThrow();
  });

  it('exports all contracts from shared entrypoint', () => {
    expect(SharedModule.normalizeText).toBeDefined();
    expect(SharedModule.StatusResponseSchema).toBeDefined();
    expect(SharedModule.decisionStatusValues).toBeDefined();
  });
});

describe('Gemma Schemas', () => {
  it('validates representative Pass A output', () => {
    const samplePassA = {
      labels: [
        { comment: 'c1', label: 'proposal', alternative: 'Remove cgi' },
        { comment: 'c2', label: 'objection', alternative: 'Keep cgi' },
        { comment: 'c3', label: 'support', alternative: 'Remove cgi' },
        { comment: 'c4', label: 'decision', alternative: null },
        { comment: 'c5', label: 'noise' },
      ],
    };
    expect(() => GemmaPassAOutputSchema.parse(samplePassA)).not.toThrow();
  });

  it('rejects Pass A with non-thread-local comment IDs', () => {
    const invalidPassA = {
      labels: [{ comment: 'comment_123', label: 'proposal' }],
    };
    expect(() => GemmaPassAOutputSchema.parse(invalidPassA)).toThrow();
  });

  it('validates representative Pass B output', () => {
    const samplePassB = {
      decisions: [
        {
          title: 'Deprecate and remove cgi module',
          status: 'accepted',
          summary: 'Deprecate cgi in Python 3.11 and remove in 3.13 per PEP 594.',
          decision_evidence: [
            {
              comment: 'c25',
              quote: 'The Steering Council accepts PEP 594.',
            },
          ],
          alternatives: [
            {
              name: 'Keep cgi in stdlib',
              description: 'Retain cgi for backward compatibility with simple scripts.',
              outcome: 'rejected',
              reason: 'Unmaintained and presents security liabilities.',
              reason_category: 'security',
              evidence: [
                {
                  comment: 'c4',
                  quote: 'The cgi module has unpatched security concerns in multipart parsing.',
                  claim: 'rejection_reason',
                },
              ],
              conditions: [
                {
                  text: 'Requires multipart parsing outside standard library',
                  kind: 'dependency',
                  probe: 'none',
                  probe_value: null,
                },
              ],
            },
          ],
          events: [
            {
              comment: 'c1',
              event: 'proposed',
            },
            {
              comment: 'c25',
              event: 'decided',
            },
          ],
        },
      ],
    };
    expect(() => GemmaPassBOutputSchema.parse(samplePassB)).not.toThrow();
  });

  it('rejects Pass B with invalid claim type', () => {
    const invalidPassB = {
      decisions: [
        {
          title: 'Sample',
          status: 'accepted',
          summary: 'Summary',
          decision_evidence: [{ comment: 'c1', quote: 'Text' }],
          alternatives: [
            {
              name: 'Alt',
              description: 'Desc',
              outcome: 'rejected',
              evidence: [
                {
                  comment: 'c2',
                  quote: 'Quote',
                  // @ts-expect-error test invalid claim
                  claim: 'invalid_claim_type',
                },
              ],
              conditions: [],
            },
          ],
          events: [],
        },
      ],
    };
    expect(() => GemmaPassBOutputSchema.parse(invalidPassB)).toThrow();
  });
});

describe('Shared Contract Barrel Exports', () => {
  it('exposes all schemas, enums, gemma prompts, and normalization functions', () => {
    expect(sharedBarrel.DecisionDetailSchema).toBeDefined();
    expect(sharedBarrel.decisionStatusValues).toBeDefined();
    expect(sharedBarrel.GemmaPassAOutputSchema).toBeDefined();
    expect(sharedBarrel.normalizeText).toBeDefined();
    expect(typeof sharedBarrel.normalizeText).toBe('function');
  });
});
