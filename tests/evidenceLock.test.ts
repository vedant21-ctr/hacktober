import { describe, expect, it } from 'vitest';
import {
  verifyQuote,
  calculateDecisionConfidence,
  stringSimilarity,
  MIN_QUOTE_LENGTH,
  MAX_QUOTE_LENGTH,
} from '../server/verify/evidenceLock.js';
import { normalizeText } from '@decisionvault/shared/normalize';

describe('Evidence Lock — Deterministic Quote Verification', () => {
  const originalComment = `We reached consensus during the team sync: We will deprecate Python 2.7 support in version 3.0 and migrate our CI runners to Python 3.11+. Continuing to support 2.7 introduces severe security and maintenance bottlenecks.`;
  const normalizedBody = normalizeText(originalComment);

  it('verifies exact normalized quotes with match offsets and score 1.0', () => {
    const rawQuote =
      'We will deprecate Python 2.7 support in version 3.0 and migrate our CI runners to Python 3.11+.';
    const result = verifyQuote(rawQuote, normalizedBody);

    expect(result.verified).toBe(true);
    expect(result.method).toBe('normalized_exact');
    expect(result.score).toBe(1.0);
    expect(result.matchStart).toBeGreaterThanOrEqual(0);
    expect(result.matchEnd).toBeGreaterThan(result.matchStart!);
  });

  it('verifies quotes regardless of markdown formatting or curly quotes in original text', () => {
    const rawCommentWithMarkdown = `After long discussion, **We decided to standardize on SQLite for local metadata storage** rather than maintaining multiple embedded backends.`;
    const norm = normalizeText(rawCommentWithMarkdown);

    // Gemma copied text without markdown stars
    const plainQuote = 'we decided to standardize on sqlite for local metadata storage';
    const result = verifyQuote(plainQuote, norm);

    expect(result.verified).toBe(true);
    expect(result.method).toBe('normalized_exact');
    expect(result.score).toBe(1.0);
  });

  it('rejects quotes below the minimum 20-character threshold to prevent trivial matches', () => {
    const shortQuote = 'We agreed to merge'; // 18 chars
    expect(normalizeText(shortQuote).length).toBeLessThan(MIN_QUOTE_LENGTH);

    const result = verifyQuote(shortQuote, normalizedBody);
    expect(result.verified).toBe(false);
    expect(result.method).toBe('none');
    expect(result.score).toBe(0);
  });

  it('rejects quotes exceeding the maximum 400-character threshold', () => {
    const longQuote = 'a'.repeat(405);
    const result = verifyQuote(longQuote, normalizedBody);

    expect(result.verified).toBe(false);
    expect(result.method).toBe('none');
    expect(result.score).toBe(0);
  });

  it('rejects completely fabricated quotes not present in the comment', () => {
    const fabricated =
      'The entire core committee unanimously voted to rewrite the decision engine in Rust next month.';
    const result = verifyQuote(fabricated, normalizedBody);

    expect(result.verified).toBe(false);
    expect(result.method).toBe('none');
    expect(result.score).toBe(0);
  });

  it('handles approximate fuzzy matches when words have minor typo or minor alteration', () => {
    // Original contains: "Continuing to support 2.7 introduces severe security and maintenance bottlenecks."
    // Near match with single minor word variation
    const nearQuote =
      'Continuing to support 2.7 introduces severe security and maintenance bottleneck';
    const result = verifyQuote(nearQuote, normalizedBody);

    expect(result.verified).toBe(true);
    expect(['normalized_exact', 'fuzzy']).toContain(result.method);
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it('accurately calculates string similarity ratio using Levenshtein distance', () => {
    expect(stringSimilarity('identical string', 'identical string')).toBe(1.0);
    expect(stringSimilarity('', 'something')).toBe(0.0);
    expect(stringSimilarity('kitten', 'sitting')).toBeCloseTo(0.57, 1);
  });

  it('handles empty or malformed quote inputs gracefully', () => {
    expect(verifyQuote('', normalizedBody).verified).toBe(false);
    expect(verifyQuote(null as any, normalizedBody).verified).toBe(false);
    expect(verifyQuote('valid quote that is over 20 chars', '').verified).toBe(false);
  });

  it('correctly matches valid fuzzy quotes located at odd character offsets', () => {
    // Prefix with single character "x " to push match to odd start offset (e.g. index 3 or 5)
    const oddComment =
      'x ' +
      normalizeText(
        'We decided to standardize on PostgreSQL for primary persistence and Redis for short-term caching.',
      );
    // Quote with minor 1-character typo ("cacheing" instead of "caching")
    const quoteWithTypo =
      'we decided to standardize on postgresql for primary persistence and redis for short-term cacheing';

    const result = verifyQuote(quoteWithTypo, oddComment);
    expect(result.verified).toBe(true);
    expect(result.method).toBe('fuzzy');
    expect(result.score).toBeGreaterThanOrEqual(0.9);
    expect(result.matchStart! % 2).toBe(0); // starts at offset 2 ('x ')
  });

  it('correctly matches similar quotes even when the first character differs', () => {
    const commentBody = normalizeText(
      'Because of security concerns, the team officially decided to reject arbitrary script evaluation.',
    );
    // Quote with altered first word ("because" -> "securing") but otherwise near-identical (>= 90% similar)
    const rawQuote =
      'recause of security concerns, the team officially decided to reject arbitrary script evaluation.';
    const result = verifyQuote(rawQuote, commentBody);

    expect(result.verified).toBe(true);
    expect(result.method).toBe('fuzzy');
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it('evaluates long comments without match quickly within bounded computation limits', () => {
    // Generate 30,000 character synthetic comment (e.g. huge CI log or stack trace)
    const longComment = (
      'Error: failed to compile module xyz\n' + 'at runTask (index.js:12:4)\n'
    ).repeat(500);
    const normLong = normalizeText(longComment);

    const nonMatchingQuote =
      'We decided to switch the entire project database architecture from MySQL to CockroachDB.';

    const start = performance.now();
    const result = verifyQuote(nonMatchingQuote, normLong);
    const duration = performance.now() - start;

    expect(result.verified).toBe(false);
    expect(result.method).toBe('none');
    // Must complete in well under 250ms thanks to bounded candidate generation
    expect(duration).toBeLessThan(250);
  });

  it('verifies quotes at the maximum 400-character boundary', () => {
    const baseSentence =
      'The engineering consensus is to adopt TypeScript strict mode across all monorepo packages to avoid runtime undefined errors. ';
    const repeated = baseSentence.repeat(3);
    const exact400 = repeated.slice(0, 400);
    const comment = 'Discussion preamble: ' + exact400 + ' Postamble concluding RFC.';
    const norm = normalizeText(comment);

    const result = verifyQuote(exact400, norm);
    expect(result.verified).toBe(true);
    expect(result.method).toBe('normalized_exact');
    expect(result.score).toBe(1.0);
  });
});

describe('Evidence Lock — Confidence Calculation', () => {
  it('computes confidence according to Architecture v3 Section 9 specification', () => {
    // Case 1: Full exact evidence, decision statement by owner, all rejected alts have verified reasons
    const full = calculateDecisionConfidence({
      verifiedEvidenceWeight: 2.0,
      totalEvidenceClaimed: 2,
      hasVerifiedDecisionStatement: true,
      statementAuthorRole: 'owner',
      rejectedAltsCount: 1,
      rejectedAltsWithVerifiedReasonCount: 1,
    });

    // 0.4*1.0 + 0.4*1.0 + 0.2*1.0 = 1.0
    expect(full.confidence).toBe(1.0);
    expect(full.confidenceParts).toEqual({
      coverage: 1.0,
      statement: 1.0,
      reasonCoverage: 1.0,
    });

    // Case 2: Contributor statement (0.6 statement weight)
    const contributorRes = calculateDecisionConfidence({
      verifiedEvidenceWeight: 1.0,
      totalEvidenceClaimed: 1,
      hasVerifiedDecisionStatement: true,
      statementAuthorRole: 'contributor',
      rejectedAltsCount: 0,
      rejectedAltsWithVerifiedReasonCount: 0,
    });

    // 0.4*1.0 + 0.4*0.6 + 0.2*1.0 = 0.4 + 0.24 + 0.2 = 0.84
    expect(contributorRes.confidence).toBe(0.84);
    expect(contributorRes.confidenceParts.statement).toBe(0.6);

    // Case 3: No verified statement and unverified rejected reason
    const unverifiedRes = calculateDecisionConfidence({
      verifiedEvidenceWeight: 0,
      totalEvidenceClaimed: 2,
      hasVerifiedDecisionStatement: false,
      statementAuthorRole: 'none',
      rejectedAltsCount: 1,
      rejectedAltsWithVerifiedReasonCount: 0,
    });

    // 0.4*0 + 0.4*0 + 0.2*0 = 0.0
    expect(unverifiedRes.confidence).toBe(0.0);
    expect(unverifiedRes.confidenceParts).toEqual({
      coverage: 0,
      statement: 0,
      reasonCoverage: 0,
    });
  });
});
