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
  | 'substring';

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
