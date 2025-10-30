import wasm from './wasm.js';

export type NormalizationPreset = 'none' | 'minimal' | 'default' | 'aggressive';

export function levenshtein(a: string, b: string): number {
  return wasm.levenshtein(a, b);
}

export function normalized_levenshtein(a: string, b: string): number {
  return wasm.normalized_levenshtein(a, b);
}

export function osa_distance(a: string, b: string): number {
  return wasm.osa_distance(a, b);
}

export function normalized_osa_similarity(a: string, b: string): number {
  return wasm.normalized_osa_similarity(a, b);
}

export function damerau_levenshtein(a: string, b: string): number {
  return wasm.damerau_levenshtein(a, b);
}

export function normalized_damerau_levenshtein(a: string, b: string): number {
  return wasm.normalized_damerau_levenshtein(a, b);
}

export function jaro(a: string, b: string): number {
  return wasm.jaro(a, b);
}

export function jaro_winkler(a: string, b: string): number {
  return wasm.jaro_winkler(a, b);
}

export function jaro_winkler_custom(
  a: string,
  b: string,
  options: { prefix_scale?: number; max_prefix?: number } = {},
): number {
  const prefixScale = options.prefix_scale ?? 0.1;
  const maxPrefix = options.max_prefix ?? 4;
  return wasm.jaro_winkler_with_params(a, b, prefixScale, maxPrefix);
}

export function normalize(input: string, preset: NormalizationPreset = 'none'): string {
  return wasm.normalize(input, preset);
}

// ============================================================================
// RapidFuzz Fuzz Module - Ratio-based similarity (0-100 scale)
// ============================================================================

/**
 * Basic fuzzy string comparison using Indel distance
 * Returns similarity score as percentage (0-100)
 */
export function ratio(a: string, b: string): number {
  return wasm.ratio(a, b);
}

// ============================================================================
// RapidFuzz Distance Module - Indel metrics
// ============================================================================

/**
 * Indel distance (insertion/deletion only, no substitutions)
 * Returns the minimum number of insertions and deletions required
 */
export function indel_distance(a: string, b: string): number {
  return wasm.indel_distance(a, b);
}

/**
 * Normalized Indel similarity (0.0-1.0 scale)
 */
export function indel_normalized_similarity(a: string, b: string): number {
  return wasm.indel_normalized_similarity(a, b);
}

// ============================================================================
// RapidFuzz Distance Module - LCS (Longest Common Subsequence) metrics
// ============================================================================

/**
 * LCS distance - number of characters that need to be added/removed
 */
export function lcs_seq_distance(a: string, b: string): number {
  return wasm.lcs_seq_distance(a, b);
}

/**
 * LCS similarity - length of the longest common subsequence
 */
export function lcs_seq_similarity(a: string, b: string): number {
  return wasm.lcs_seq_similarity(a, b);
}

/**
 * Normalized LCS similarity (0.0-1.0 scale)
 */
export function lcs_seq_normalized_similarity(a: string, b: string): number {
  return wasm.lcs_seq_normalized_similarity(a, b);
}

// ============================================================================
// Token-based Fuzzy Matching (TypeScript implementations)
// ============================================================================

/**
 * Tokenize a string by splitting on whitespace
 */
const tokenize = (str: string): string[] => {
  return str
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
};

/**
 * Partial ratio - finds the best matching substring
 * Uses sliding window to find the best match between strings
 * Returns similarity score as percentage (0-100)
 */
export function partialRatio(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) {
    return a === b ? 100 : 0;
  }

  // Make 'shorter' the shorter string and 'longer' the longer one
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];

  if (shorter.length === 0) return 0;

  // If shorter string is contained in longer, compare them directly
  if (longer.includes(shorter)) {
    return ratio(shorter, shorter);
  }

  // Use sliding window to find best match
  let maxRatio = 0;
  const shorterLen = shorter.length;

  for (let i = 0; i <= longer.length - shorterLen; i++) {
    const substring = longer.substring(i, i + shorterLen);
    const currentRatio = ratio(shorter, substring);
    maxRatio = Math.max(maxRatio, currentRatio);
  }

  return maxRatio;
}

/**
 * Token sort ratio - sorts tokens alphabetically before comparison
 * Useful for order-insensitive comparison
 * Returns similarity score as percentage (0-100)
 */
export function tokenSortRatio(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);

  // Sort tokens alphabetically
  const sortedA = tokensA.sort().join(' ');
  const sortedB = tokensB.sort().join(' ');

  return ratio(sortedA, sortedB);
}

/**
 * Token set ratio - uses set operations on tokens for comparison
 * Handles differences in token order and duplication
 * Returns similarity score as percentage (0-100)
 */
export function tokenSetRatio(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);

  if (tokensA.length === 0 && tokensB.length === 0) {
    return 100;
  }

  if (tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }

  // Create sets for intersection and difference operations
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  // Find intersection (common tokens)
  const intersection = new Set([...setA].filter((token) => setB.has(token)));

  // Find differences (unique to each set)
  const diffA = [...setA].filter((token) => !intersection.has(token));
  const diffB = [...setB].filter((token) => !intersection.has(token));

  const intersectionStr = [...intersection].sort().join(' ');
  const diffAStr = diffA.sort().join(' ');
  const diffBStr = diffB.sort().join(' ');

  // Build strings for comparison
  const sortedIntersection = intersectionStr;
  const strA = sortedIntersection + (diffAStr ? ` ${diffAStr}` : '');
  const strB = sortedIntersection + (diffBStr ? ` ${diffBStr}` : '');

  // Compare: intersection vs intersection, full vs full, and intersection vs each full
  const scores = [
    ratio(sortedIntersection, sortedIntersection),
    ratio(strA, strB),
    ratio(sortedIntersection, strA),
    ratio(sortedIntersection, strB),
  ];

  return Math.max(...scores);
}

// ============================================================================
// Process Module - Finding best matches from a list (TypeScript implementations)
// ============================================================================

export type ScorerFunction = (a: string, b: string) => number;

export interface ExtractOptions {
  scorer?: ScorerFunction;
  processor?: (str: string) => string;
  score_cutoff?: number;
  limit?: number;
}

export interface ExtractResult {
  choice: string;
  score: number;
  index: number;
}

/**
 * Find the best match from a list of choices
 * Returns the best matching choice with its score and index
 */
export function extractOne(
  query: string,
  choices: string[],
  options: ExtractOptions = {},
): ExtractResult | null {
  const { scorer = ratio, processor = (s) => s, score_cutoff = 0 } = options;

  if (choices.length === 0) {
    return null;
  }

  const processedQuery = processor(query);
  let bestMatch: ExtractResult | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i];
    const processedChoice = processor(choice);
    const score = scorer(processedQuery, processedChoice);

    if (score >= score_cutoff && score > bestScore) {
      bestScore = score;
      bestMatch = {
        choice,
        score,
        index: i,
      };
    }
  }

  return bestMatch;
}

/**
 * Find the top N best matches from a list of choices
 * Returns an array of matches sorted by score (best first)
 */
export function extract(
  query: string,
  choices: string[],
  options: ExtractOptions = {},
): ExtractResult[] {
  const { scorer = ratio, processor = (s) => s, score_cutoff = 0, limit } = options;

  if (choices.length === 0) {
    return [];
  }

  const processedQuery = processor(query);
  const results: ExtractResult[] = [];

  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i];
    const processedChoice = processor(choice);
    const score = scorer(processedQuery, processedChoice);

    if (score >= score_cutoff) {
      results.push({
        choice,
        score,
        index: i,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Apply limit if specified
  return limit !== undefined ? results.slice(0, limit) : results;
}

// ============================================================================
// Unified API - Metric-selectable distance and scoring
// ============================================================================

export type DistanceMetric = 'levenshtein' | 'damerau_levenshtein' | 'osa' | 'indel' | 'lcs_seq';

export type SimilarityMetric =
  | 'levenshtein'
  | 'damerau_levenshtein'
  | 'osa'
  | 'jaro'
  | 'jaro_winkler'
  | 'indel'
  | 'lcs_seq'
  | 'ratio'
  | 'partial_ratio'
  | 'token_sort_ratio'
  | 'token_set_ratio';

/**
 * Calculate edit distance between two strings using the specified metric
 * Returns the raw distance (number of edits required)
 *
 * @param a First string
 * @param b Second string
 * @param metric Distance metric to use (default: 'levenshtein')
 * @returns Edit distance (raw number)
 */
export function distance(a: string, b: string, metric: DistanceMetric = 'levenshtein'): number {
  switch (metric) {
    case 'levenshtein':
      return levenshtein(a, b);
    case 'damerau_levenshtein':
      return damerau_levenshtein(a, b);
    case 'osa':
      return osa_distance(a, b);
    case 'indel':
      return indel_distance(a, b);
    case 'lcs_seq':
      return lcs_seq_distance(a, b);
    default:
      throw new Error(`Unknown distance metric: ${metric}`);
  }
}

/**
 * Calculate similarity score between two strings using the specified metric
 * Returns normalized similarity score (0.0-1.0) where 1.0 is identical
 *
 * @param a First string
 * @param b Second string
 * @param metric Similarity metric to use (default: 'jaro_winkler')
 * @returns Similarity score (0.0-1.0)
 */
export function score(a: string, b: string, metric: SimilarityMetric = 'jaro_winkler'): number {
  switch (metric) {
    case 'levenshtein':
      return normalized_levenshtein(a, b);
    case 'damerau_levenshtein':
      return normalized_damerau_levenshtein(a, b);
    case 'osa':
      return normalized_osa_similarity(a, b);
    case 'jaro':
      return jaro(a, b);
    case 'jaro_winkler':
      return jaro_winkler(a, b);
    case 'indel':
      return indel_normalized_similarity(a, b);
    case 'lcs_seq':
      return lcs_seq_normalized_similarity(a, b);
    case 'ratio':
      return ratio(a, b) / 100; // Convert 0-100 to 0-1
    case 'partial_ratio':
      return partialRatio(a, b) / 100; // Convert 0-100 to 0-1
    case 'token_sort_ratio':
      return tokenSortRatio(a, b) / 100; // Convert 0-100 to 0-1
    case 'token_set_ratio':
      return tokenSetRatio(a, b) / 100; // Convert 0-100 to 0-1
    default:
      throw new Error(`Unknown similarity metric: ${metric}`);
  }
}

export interface SubstringResult {
  score: number;
  queryRange: [number, number];
  candidateRange: [number, number];
}

const toCodePoints = (value: string): string[] => Array.from(value);

export function substringSimilarity(query: string, candidate: string): SubstringResult {
  const aChars = toCodePoints(query);
  const bChars = toCodePoints(candidate);
  const m = aChars.length;
  const n = bChars.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  let maxLen = 0;
  let endA = 0;
  let endB = 0;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aChars[i - 1] === bChars[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > maxLen) {
          maxLen = dp[i][j];
          endA = i;
          endB = j;
        }
      } else {
        dp[i][j] = 0;
      }
    }
  }

  const score = maxLen === 0 ? 0 : (2 * maxLen) / (m + n);
  const startA = endA - maxLen;
  const startB = endB - maxLen;

  return {
    score,
    queryRange: [startA, endA],
    candidateRange: [startB, endB],
  };
}

export type SuggestMetric =
  | 'levenshtein'
  | 'damerau_osa'
  | 'damerau_unrestricted'
  | 'jaro'
  | 'jaro_winkler'
  | 'substring'
  | 'ratio'
  | 'partial_ratio'
  | 'token_sort_ratio'
  | 'token_set_ratio'
  | 'indel'
  | 'lcs_seq';

export interface SuggestionOptions {
  metric?: SuggestMetric;
  preset?: NormalizationPreset;
  normalize_preset?: NormalizationPreset;
  min_score?: number;
  max_suggestions?: number;
  prefer_prefix?: boolean;
  jaro_prefix_scale?: number;
  jaro_max_prefix?: number;
}

export interface Suggestion {
  value: string;
  score: number;
  matchedRange?: { start: number; end: number };
  normalized_value?: string;
  reason?: string;
}

const computeSimilarity = (
  metric: SuggestMetric,
  query: string,
  candidate: string,
  jaroOptions: { prefixScale: number; maxPrefix: number },
): { score: number; matchedRange?: { start: number; end: number }; explanation: string } => {
  switch (metric) {
    case 'levenshtein': {
      const score = normalized_levenshtein(query, candidate);
      return { score, explanation: `normalized_levenshtein=${score.toFixed(4)}` };
    }
    case 'damerau_osa': {
      const score = normalized_osa_similarity(query, candidate);
      return { score, explanation: `normalized_osa_similarity=${score.toFixed(4)}` };
    }
    case 'damerau_unrestricted': {
      const score = normalized_damerau_levenshtein(query, candidate);
      return { score, explanation: `normalized_damerau_levenshtein=${score.toFixed(4)}` };
    }
    case 'jaro': {
      const score = jaro(query, candidate);
      return { score, explanation: `jaro=${score.toFixed(4)}` };
    }
    case 'jaro_winkler': {
      const score = jaro_winkler_custom(query, candidate, {
        prefix_scale: jaroOptions.prefixScale,
        max_prefix: jaroOptions.maxPrefix,
      });
      return {
        score,
        explanation: `jaro_winkler(prefix_scale=${jaroOptions.prefixScale}, max_prefix=${jaroOptions.maxPrefix})=${score.toFixed(4)}`,
      };
    }
    case 'substring': {
      const result = substringSimilarity(query, candidate);
      return {
        score: result.score,
        matchedRange: { start: result.candidateRange[0], end: result.candidateRange[1] },
        explanation: `substring score=${result.score.toFixed(4)}`,
      };
    }
    case 'ratio': {
      const rawScore = ratio(query, candidate);
      const score = rawScore / 100; // Convert 0-100 to 0-1
      return { score, explanation: `ratio=${score.toFixed(4)}` };
    }
    case 'partial_ratio': {
      const rawScore = partialRatio(query, candidate);
      const score = rawScore / 100; // Convert 0-100 to 0-1
      return { score, explanation: `partial_ratio=${score.toFixed(4)}` };
    }
    case 'token_sort_ratio': {
      const rawScore = tokenSortRatio(query, candidate);
      const score = rawScore / 100; // Convert 0-100 to 0-1
      return { score, explanation: `token_sort_ratio=${score.toFixed(4)}` };
    }
    case 'token_set_ratio': {
      const rawScore = tokenSetRatio(query, candidate);
      const score = rawScore / 100; // Convert 0-100 to 0-1
      return { score, explanation: `token_set_ratio=${score.toFixed(4)}` };
    }
    case 'indel': {
      const score = indel_normalized_similarity(query, candidate);
      return { score, explanation: `indel_normalized_similarity=${score.toFixed(4)}` };
    }
    case 'lcs_seq': {
      const score = lcs_seq_normalized_similarity(query, candidate);
      return { score, explanation: `lcs_seq_normalized_similarity=${score.toFixed(4)}` };
    }
    default:
      throw new Error(`Unknown metric: ${metric}`);
  }
};

export function suggest(
  rawQuery: string,
  candidates: string[],
  options: SuggestionOptions = {},
): Suggestion[] {
  const {
    metric = 'jaro_winkler',
    preset: presetOption,
    normalize_preset: legacyPreset,
    min_score = 0.6,
    max_suggestions = 5,
    prefer_prefix = false,
    jaro_prefix_scale = 0.1,
    jaro_max_prefix = 4,
  } = options;

  const preset = presetOption ?? legacyPreset ?? 'default';

  const normQuery = normalize(rawQuery, preset);

  const scored = candidates.map((candidate) => {
    const normCandidate = normalize(candidate, preset);
    const { score, matchedRange, explanation } = computeSimilarity(
      metric,
      normQuery,
      normCandidate,
      {
        prefixScale: jaro_prefix_scale,
        maxPrefix: jaro_max_prefix,
      },
    );

    let finalScore = score;
    const reasons = [explanation];

    if (prefer_prefix && normCandidate.startsWith(normQuery)) {
      const bonusWeight = 0.1;
      finalScore = Math.min(1, finalScore + (1 - finalScore) * bonusWeight);
      reasons.push('prefix_bonus');
    }

    return {
      value: candidate,
      score: finalScore,
      normalized_value: normCandidate,
      matchedRange,
      reason: reasons.join(', '),
    };
  });

  return scored
    .filter((entry) => entry.score >= min_score)
    .sort((a, b) => b.score - a.score)
    .slice(0, max_suggestions);
}
