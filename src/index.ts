import wasm from './wasm.js';

export type NormalizationPreset = 'none' | 'minimal' | 'default' | 'aggressive';
export type NormalizationLocale = 'tr' | 'az' | 'lt';

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

/**
 * Normalize a string using the specified preset and optional locale
 *
 * @param input - The string to normalize
 * @param preset - Normalization preset (none, minimal, default, aggressive)
 * @param locale - Optional locale for locale-specific case folding (tr, az, lt)
 * @returns Normalized string
 *
 * Locale-specific behavior:
 * - 'tr'/'az' (Turkish/Azerbaijani): İ→i, I→ı (dotted/dotless I handling)
 * - 'lt' (Lithuanian): Preserves combining dots with accents
 * - undefined: Standard Unicode casefold (İ→i̇ with combining dot)
 */
export function normalize(
  input: string,
  preset: NormalizationPreset = 'none',
  locale?: NormalizationLocale,
): string {
  if (locale !== undefined) {
    return wasm.normalize_with_locale(input, preset, locale);
  }
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
  const scores = [ratio(strA, strB)];

  // Only include intersection comparisons if there's a non-empty intersection
  if (sortedIntersection.length > 0) {
    scores.push(ratio(sortedIntersection, sortedIntersection));
    scores.push(ratio(sortedIntersection, strA));
    scores.push(ratio(sortedIntersection, strB));
  }

  return Math.max(...scores);
}

// ============================================================================
// Process Module - Finding best matches from a list (TypeScript implementations)
// ============================================================================

export type ScorerFunction = (a: string, b: string) => number;

export interface ExtractOptions {
  scorer?: ScorerFunction;
  processor?: (str: string) => string;
  scoreCutoff?: number;
  score_cutoff?: number;
  limit?: number;
}

type NormalizedExtractOptions = {
  scorer: ScorerFunction;
  processor: (str: string) => string;
  scoreCutoff: number;
  limit?: number;
};

const defaultProcessor = (value: string): string => value;

const normalizeExtractOptions = (options: ExtractOptions = {}): NormalizedExtractOptions => {
  const scorer = options.scorer ?? ratio;
  const processor = options.processor ?? defaultProcessor;
  const scoreCutoff = options.scoreCutoff ?? options.score_cutoff ?? 0;

  return {
    scorer,
    processor,
    scoreCutoff,
    limit: options.limit,
  };
};

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
  const { scorer, processor, scoreCutoff } = normalizeExtractOptions(options);

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

    if (score >= scoreCutoff && score > bestScore) {
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
  const { scorer, processor, scoreCutoff, limit } = normalizeExtractOptions(options);

  if (choices.length === 0) {
    return [];
  }

  const processedQuery = processor(query);
  const results: ExtractResult[] = [];

  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i];
    const processedChoice = processor(choice);
    const score = scorer(processedQuery, processedChoice);

    if (score >= scoreCutoff) {
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

type DistanceMetricCamel = 'levenshtein' | 'damerauLevenshtein' | 'osa' | 'indel' | 'lcsSeq';
type DistanceMetricSnake =
  | 'levenshtein'
  | 'damerau_levenshtein'
  | 'damerau_unrestricted'
  | 'damerau_osa'
  | 'osa'
  | 'indel'
  | 'lcs_seq';
export type DistanceMetric = DistanceMetricCamel | DistanceMetricSnake;

type SimilarityMetricCamel =
  | 'levenshtein'
  | 'damerauLevenshtein'
  | 'osa'
  | 'jaro'
  | 'jaroWinkler'
  | 'indel'
  | 'lcsSeq'
  | 'ratio'
  | 'partialRatio'
  | 'tokenSortRatio'
  | 'tokenSetRatio';

type SimilarityMetricSnake =
  | 'levenshtein'
  | 'damerau_levenshtein'
  | 'damerau_unrestricted'
  | 'damerau_osa'
  | 'osa'
  | 'jaro'
  | 'jaro_winkler'
  | 'indel'
  | 'lcs_seq'
  | 'ratio'
  | 'partial_ratio'
  | 'token_sort_ratio'
  | 'token_set_ratio';
export type SimilarityMetric = SimilarityMetricCamel | SimilarityMetricSnake;

const normalizeDistanceMetric = (metric: DistanceMetric = 'levenshtein'): DistanceMetricCamel => {
  switch (metric) {
    case 'damerauLevenshtein':
    case 'damerau_levenshtein':
    case 'damerau_unrestricted':
      return 'damerauLevenshtein';
    case 'damerau_osa':
      return 'osa';
    case 'lcsSeq':
    case 'lcs_seq':
      return 'lcsSeq';
    case 'levenshtein':
    case 'osa':
    case 'indel':
      return metric;
    default:
      throw new Error(`Unknown distance metric: ${metric as string}`);
  }
};

const normalizeSimilarityMetric = (
  metric: SimilarityMetric = 'jaroWinkler',
): SimilarityMetricCamel => {
  switch (metric) {
    case 'damerauLevenshtein':
    case 'damerau_levenshtein':
    case 'damerau_unrestricted':
      return 'damerauLevenshtein';
    case 'jaroWinkler':
    case 'jaro_winkler':
      return 'jaroWinkler';
    case 'lcsSeq':
    case 'lcs_seq':
      return 'lcsSeq';
    case 'damerau_osa':
      return 'osa';
    case 'partialRatio':
    case 'partial_ratio':
      return 'partialRatio';
    case 'tokenSortRatio':
    case 'token_sort_ratio':
      return 'tokenSortRatio';
    case 'tokenSetRatio':
    case 'token_set_ratio':
      return 'tokenSetRatio';
    case 'levenshtein':
    case 'osa':
    case 'jaro':
    case 'indel':
    case 'ratio':
      return metric as SimilarityMetricCamel;
    default:
      throw new Error(`Unknown similarity metric: ${metric as string}`);
  }
};

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
  const normalizedMetric = normalizeDistanceMetric(metric);

  switch (normalizedMetric) {
    case 'levenshtein':
      return levenshtein(a, b);
    case 'damerauLevenshtein':
      return damerau_levenshtein(a, b);
    case 'osa':
      return osa_distance(a, b);
    case 'indel':
      return indel_distance(a, b);
    case 'lcsSeq':
      return lcs_seq_distance(a, b);
    default:
      throw new Error(`Unknown distance metric: ${normalizedMetric as string}`);
  }
}

/**
 * Calculate similarity score between two strings using the specified metric
 * Returns normalized similarity score (0.0-1.0) where 1.0 is identical
 *
 * @param a First string
 * @param b Second string
 * @param metric Similarity metric to use (default: 'jaroWinkler')
 * @returns Similarity score (0.0-1.0)
 */
export function score(a: string, b: string, metric: SimilarityMetric = 'jaroWinkler'): number {
  const normalizedMetric = normalizeSimilarityMetric(metric);

  switch (normalizedMetric) {
    case 'levenshtein':
      return normalized_levenshtein(a, b);
    case 'damerauLevenshtein':
      return normalized_damerau_levenshtein(a, b);
    case 'osa':
      return normalized_osa_similarity(a, b);
    case 'jaro':
      return jaro(a, b);
    case 'jaroWinkler':
      return jaro_winkler(a, b);
    case 'indel':
      return indel_normalized_similarity(a, b);
    case 'lcsSeq':
      return lcs_seq_normalized_similarity(a, b);
    case 'ratio':
      return ratio(a, b) / 100; // Convert 0-100 to 0-1
    case 'partialRatio':
      return partialRatio(a, b) / 100; // Convert 0-100 to 0-1
    case 'tokenSortRatio':
      return tokenSortRatio(a, b) / 100; // Convert 0-100 to 0-1
    case 'tokenSetRatio':
      return tokenSetRatio(a, b) / 100; // Convert 0-100 to 0-1
    default:
      throw new Error(`Unknown similarity metric: ${normalizedMetric as string}`);
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

type SuggestMetricCamel =
  | 'levenshtein'
  | 'damerauOsa'
  | 'damerauUnrestricted'
  | 'jaro'
  | 'jaroWinkler'
  | 'substring'
  | 'ratio'
  | 'partialRatio'
  | 'tokenSortRatio'
  | 'tokenSetRatio'
  | 'indel'
  | 'lcsSeq';

type SuggestMetricSnake =
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

export type SuggestMetric = SuggestMetricCamel | SuggestMetricSnake;

const normalizeSuggestMetric = (metric: SuggestMetric = 'jaroWinkler'): SuggestMetricCamel => {
  switch (metric) {
    case 'damerauOsa':
    case 'damerau_osa':
      return 'damerauOsa';
    case 'damerauUnrestricted':
    case 'damerau_unrestricted':
      return 'damerauUnrestricted';
    case 'jaroWinkler':
    case 'jaro_winkler':
      return 'jaroWinkler';
    case 'partialRatio':
    case 'partial_ratio':
      return 'partialRatio';
    case 'tokenSortRatio':
    case 'token_sort_ratio':
      return 'tokenSortRatio';
    case 'tokenSetRatio':
    case 'token_set_ratio':
      return 'tokenSetRatio';
    case 'lcsSeq':
    case 'lcs_seq':
      return 'lcsSeq';
    case 'levenshtein':
    case 'jaro':
    case 'substring':
    case 'ratio':
    case 'indel':
      return metric as SuggestMetricCamel;
    default:
      throw new Error(`Unknown suggestion metric: ${metric as string}`);
  }
};

export interface SuggestionOptions {
  metric?: SuggestMetric;
  preset?: NormalizationPreset;
  normalizePreset?: NormalizationPreset;
  normalize_preset?: NormalizationPreset;
  minScore?: number;
  min_score?: number;
  maxSuggestions?: number;
  max_suggestions?: number;
  preferPrefix?: boolean;
  prefer_prefix?: boolean;
  jaroPrefixScale?: number;
  jaro_prefix_scale?: number;
  jaroMaxPrefix?: number;
  jaro_max_prefix?: number;
}

type NormalizedSuggestionOptions = {
  metric: SuggestMetricCamel;
  preset?: NormalizationPreset;
  normalizePreset?: NormalizationPreset;
  minScore: number;
  maxSuggestions: number;
  preferPrefix: boolean;
  jaroPrefixScale: number;
  jaroMaxPrefix: number;
};

const normalizeSuggestionOptions = (
  options: SuggestionOptions = {},
): NormalizedSuggestionOptions => {
  const metric = normalizeSuggestMetric(options.metric ?? 'jaroWinkler');
  const preset = options.preset;
  const normalizePresetOption = options.normalizePreset ?? options.normalize_preset;
  const minScore = options.minScore ?? options.min_score ?? 0.6;
  const maxSuggestions = options.maxSuggestions ?? options.max_suggestions ?? 5;
  const preferPrefix = options.preferPrefix ?? options.prefer_prefix ?? false;
  const jaroPrefixScale = options.jaroPrefixScale ?? options.jaro_prefix_scale ?? 0.1;
  const jaroMaxPrefix = options.jaroMaxPrefix ?? options.jaro_max_prefix ?? 4;

  return {
    metric,
    preset,
    normalizePreset: normalizePresetOption,
    minScore,
    maxSuggestions,
    preferPrefix,
    jaroPrefixScale,
    jaroMaxPrefix,
  };
};

export interface Suggestion {
  value: string;
  score: number;
  matchedRange?: { start: number; end: number };
  normalizedValue?: string;
  reason?: string;
}

const computeSimilarity = (
  metric: SuggestMetricCamel,
  query: string,
  candidate: string,
  jaroOptions: { prefixScale: number; maxPrefix: number },
): { score: number; matchedRange?: { start: number; end: number }; explanation: string } => {
  switch (metric) {
    case 'levenshtein': {
      const score = normalized_levenshtein(query, candidate);
      return { score, explanation: `normalized_levenshtein=${score.toFixed(4)}` };
    }
    case 'damerauOsa': {
      const score = normalized_osa_similarity(query, candidate);
      return { score, explanation: `normalized_osa_similarity=${score.toFixed(4)}` };
    }
    case 'damerauUnrestricted': {
      const score = normalized_damerau_levenshtein(query, candidate);
      return { score, explanation: `normalized_damerau_levenshtein=${score.toFixed(4)}` };
    }
    case 'jaro': {
      const score = jaro(query, candidate);
      return { score, explanation: `jaro=${score.toFixed(4)}` };
    }
    case 'jaroWinkler': {
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
    case 'partialRatio': {
      const rawScore = partialRatio(query, candidate);
      const score = rawScore / 100; // Convert 0-100 to 0-1
      return { score, explanation: `partial_ratio=${score.toFixed(4)}` };
    }
    case 'tokenSortRatio': {
      const rawScore = tokenSortRatio(query, candidate);
      const score = rawScore / 100; // Convert 0-100 to 0-1
      return { score, explanation: `token_sort_ratio=${score.toFixed(4)}` };
    }
    case 'tokenSetRatio': {
      const rawScore = tokenSetRatio(query, candidate);
      const score = rawScore / 100; // Convert 0-100 to 0-1
      return { score, explanation: `token_set_ratio=${score.toFixed(4)}` };
    }
    case 'indel': {
      const score = indel_normalized_similarity(query, candidate);
      return { score, explanation: `indel_normalized_similarity=${score.toFixed(4)}` };
    }
    case 'lcsSeq': {
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
    metric,
    preset: presetOption,
    normalizePreset: normalizePresetOption,
    minScore,
    maxSuggestions,
    preferPrefix,
    jaroPrefixScale,
    jaroMaxPrefix,
  } = normalizeSuggestionOptions(options);

  const preset = presetOption ?? normalizePresetOption ?? 'default';

  const normQuery = normalize(rawQuery, preset);

  const scored = candidates.map((candidate) => {
    const normCandidate = normalize(candidate, preset);
    const { score, matchedRange, explanation } = computeSimilarity(
      metric,
      normQuery,
      normCandidate,
      {
        prefixScale: jaroPrefixScale,
        maxPrefix: jaroMaxPrefix,
      },
    );

    let finalScore = score;
    const reasons = [explanation];

    if (preferPrefix && normCandidate.startsWith(normQuery)) {
      const bonusWeight = 0.1;
      finalScore = Math.min(1, finalScore + (1 - finalScore) * bonusWeight);
      reasons.push('prefix_bonus');
    }

    return {
      value: candidate,
      score: finalScore,
      normalizedValue: normCandidate,
      matchedRange,
      reason: reasons.join(', '),
    };
  });

  return scored
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);
}
