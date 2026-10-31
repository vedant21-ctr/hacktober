import { normalizeText } from '@decisionvault/shared/normalize';
import type { VerificationMethod } from '@decisionvault/shared/enums';
import type { ConfidenceParts } from '@decisionvault/shared/api';

export interface EvidenceVerificationResult {
  verified: boolean;
  method: VerificationMethod;
  score: number;
  /**
   * Character start offset within normalized comment text (comments.body_norm).
   * Note: Offsets index into normalized text (post-NFKC, lowercase, stripped markdown/whitespace),
   * not raw original comment text.
   */
  matchStart: number | null;
  /**
   * Character end offset within normalized comment text (comments.body_norm).
   */
  matchEnd: number | null;
  normalizedQuote: string;
}

export const MIN_QUOTE_LENGTH = 20;
export const MAX_QUOTE_LENGTH = 400;
export const FUZZY_THRESHOLD = 0.9;
export const MAX_FUZZY_CANDIDATE_OFFSETS = 300;

/**
 * Calculates Levenshtein similarity ratio between two strings [0.0 - 1.0].
 */
export function stringSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const l1 = s1.length;
  const l2 = s2.length;

  let prevRow = new Array<number>(l2 + 1);
  let currRow = new Array<number>(l2 + 1);
  for (let j = 0; j <= l2; j++) prevRow[j] = j;

  for (let i = 1; i <= l1; i++) {
    currRow[0] = i;
    const c1 = s1[i - 1];
    for (let j = 1; j <= l2; j++) {
      const cost = c1 === s2[j - 1] ? 0 : 1;
      currRow[j] = Math.min(prevRow[j] + 1, currRow[j - 1] + 1, prevRow[j - 1] + cost);
    }
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  const dist = prevRow[l2];
  return Math.max(0, 1.0 - dist / Math.max(l1, l2));
}

/**
 * Deterministically generates candidate starting offsets in commentBodyNorm
 * using shared word anchors from the normalized quote to bound computation.
 */
function findCandidateOffsets(
  quote: string,
  body: string,
  maxCandidates: number = MAX_FUZZY_CANDIDATE_OFFSETS,
): number[] {
  const quoteLen = quote.length;
  const bodyLen = body.length;
  const candidateSet = new Set<number>();

  // Extract distinctive words (>= 4 chars preferred, fallback to >= 3 chars)
  const allWords = quote.split(/\s+/).filter((w) => w.length >= 3);
  const words = allWords.filter((w) => w.length >= 4);
  const wordsToAnchor = (words.length >= 3 ? words : allWords).slice(0, 8);

  for (const word of wordsToAnchor) {
    const wordPosInQuote = quote.indexOf(word);
    if (wordPosInQuote === -1) continue;

    let searchStart = 0;
    while (searchStart < bodyLen && candidateSet.size < maxCandidates) {
      const foundPos = body.indexOf(word, searchStart);
      if (foundPos === -1) break;

      // Anchor start offset of quote
      const estimatedStart = foundPos - wordPosInQuote;
      for (let offset = estimatedStart - 4; offset <= estimatedStart + 4; offset++) {
        if (offset >= 0 && offset + Math.floor(quoteLen * 0.8) <= bodyLen) {
          candidateSet.add(offset);
        }
      }

      searchStart = foundPos + word.length;
    }

    if (candidateSet.size >= maxCandidates) break;
  }

  // If no word anchors matched and the body is small (<= 300 chars),
  // as a safety fallback check candidate offsets
  if (candidateSet.size === 0 && bodyLen <= 300) {
    for (let i = 0; i <= bodyLen - Math.floor(quoteLen * 0.8); i++) {
      candidateSet.add(i);
    }
  }

  return Array.from(candidateSet)
    .sort((a, b) => a - b)
    .slice(0, maxCandidates);
}

/**
 * Deterministically verifies an evidence quote against the normalized comment body.
 * Implements Architecture v3 Section 9:
 * 1. Checks minimum (20) and maximum (400) character limits.
 * 2. Method 1: Normalized exact substring containment (score 1.0).
 * 3. Method 2: Sliding-window fuzzy similarity (threshold >= 0.90) with candidate-anchored bounds.
 * 4. Otherwise: unverified (method 'none', score 0.0).
 */
export function verifyQuote(rawQuote: string, commentBodyNorm: string): EvidenceVerificationResult {
  if (!rawQuote || typeof rawQuote !== 'string') {
    return {
      verified: false,
      method: 'none',
      score: 0,
      matchStart: null,
      matchEnd: null,
      normalizedQuote: '',
    };
  }

  const normalizedQuote = normalizeText(rawQuote);

  // Length constraints to prevent trivial matches and payload abuse
  if (
    normalizedQuote.length < MIN_QUOTE_LENGTH ||
    normalizedQuote.length > MAX_QUOTE_LENGTH ||
    !commentBodyNorm
  ) {
    return {
      verified: false,
      method: 'none',
      score: 0,
      matchStart: null,
      matchEnd: null,
      normalizedQuote,
    };
  }

  // Method 1: normalized_exact
  const exactIndex = commentBodyNorm.indexOf(normalizedQuote);
  if (exactIndex !== -1) {
    return {
      verified: true,
      method: 'normalized_exact',
      score: 1.0,
      matchStart: exactIndex,
      matchEnd: exactIndex + normalizedQuote.length,
      normalizedQuote,
    };
  }

  // Method 2: fuzzy matching over bounded candidate windows
  const quoteLen = normalizedQuote.length;
  const bodyLen = commentBodyNorm.length;

  if (bodyLen >= Math.floor(quoteLen * 0.8)) {
    let bestScore = 0;
    let bestStart: number | null = null;
    let bestEnd: number | null = null;

    const candidateOffsets = findCandidateOffsets(
      normalizedQuote,
      commentBodyNorm,
      MAX_FUZZY_CANDIDATE_OFFSETS,
    );

    const windowSizes = [quoteLen, quoteLen - 2, quoteLen + 2, quoteLen - 1, quoteLen + 1].filter(
      (w) => w >= MIN_QUOTE_LENGTH && w <= bodyLen,
    );

    for (const offset of candidateOffsets) {
      for (const wSize of windowSizes) {
        if (offset + wSize > bodyLen) continue;
        const windowSlice = commentBodyNorm.slice(offset, offset + wSize);

        const score = stringSimilarity(normalizedQuote, windowSlice);
        if (score > bestScore) {
          bestScore = score;
          bestStart = offset;
          bestEnd = offset + wSize;
          if (bestScore >= 0.98) break; // Early exit on very strong match
        }
      }
      if (bestScore >= 0.98) break;
    }

    if (bestScore >= FUZZY_THRESHOLD && bestStart !== null && bestEnd !== null) {
      return {
        verified: true,
        method: 'fuzzy',
        score: Math.round(bestScore * 100) / 100,
        matchStart: bestStart,
        matchEnd: bestEnd,
        normalizedQuote,
      };
    }
  }

  return {
    verified: false,
    method: 'none',
    score: 0,
    matchStart: null,
    matchEnd: null,
    normalizedQuote,
  };
}

export interface ConfidenceInput {
  verifiedEvidenceWeight: number; // exact = 1.0, fuzzy = 0.5
  totalEvidenceClaimed: number;
  hasVerifiedDecisionStatement: boolean;
  statementAuthorRole?: string;
  rejectedAltsCount: number;
  rejectedAltsWithVerifiedReasonCount: number;
}

export interface ConfidenceCalculationResult {
  confidence: number;
  confidenceParts: ConfidenceParts;
}

/**
 * Computes decision confidence according to Architecture v3 Section 9:
 * coverage   = verified_evidence_weight / total_evidence_claimed (fuzzy=0.5, exact=1.0)
 * statement  = 1.0 if verified decision_statement is by owner/member/collaborator
 *              0.6 if verified but by contributor/none/unknown
 *              0.0 if none
 * reason_cov = rejected alternatives with verified rejection_reason / rejected alternatives (1.0 if 0 rejected)
 * confidence = 0.4*coverage + 0.4*statement + 0.2*reason_cov
 */
export function calculateDecisionConfidence(input: ConfidenceInput): ConfidenceCalculationResult {
  const coverage =
    input.totalEvidenceClaimed > 0
      ? Math.min(1.0, Math.max(0, input.verifiedEvidenceWeight / input.totalEvidenceClaimed))
      : 0.0;

  let statement = 0.0;
  if (input.hasVerifiedDecisionStatement) {
    const role = (input.statementAuthorRole || '').toLowerCase();
    if (['owner', 'member', 'collaborator'].includes(role)) {
      statement = 1.0;
    } else {
      statement = 0.6;
    }
  }

  const reasonCoverage =
    input.rejectedAltsCount > 0
      ? Math.min(
          1.0,
          Math.max(0, input.rejectedAltsWithVerifiedReasonCount / input.rejectedAltsCount),
        )
      : 1.0;

  const rawConfidence = 0.4 * coverage + 0.4 * statement + 0.2 * reasonCoverage;
  const confidence = Math.min(1.0, Math.max(0, Math.round(rawConfidence * 100) / 100));

  const confidenceParts: ConfidenceParts = {
    coverage: Math.round(coverage * 100) / 100,
    statement: Math.round(statement * 100) / 100,
    reasonCoverage: Math.round(reasonCoverage * 100) / 100,
  };

  return {
    confidence,
    confidenceParts,
  };
}
