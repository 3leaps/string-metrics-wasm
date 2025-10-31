import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  damerau_levenshtein,
  distance,
  extract,
  extractOne,
  indel_distance,
  indel_normalized_similarity,
  jaro_winkler,
  lcs_seq_distance,
  lcs_seq_normalized_similarity,
  lcs_seq_similarity,
  levenshtein,
  normalize,
  normalized_damerau_levenshtein,
  normalized_levenshtein,
  normalized_osa_similarity,
  osa_distance,
  partialRatio,
  ratio,
  score,
  substringSimilarity,
  suggest,
  tokenSetRatio,
  tokenSortRatio,
  type NormalizationPreset,
  type DistanceMetric,
  type SimilarityMetric,
  type SuggestMetric,
} from '../src/index';

// Version consistency test
describe('Version consistency', () => {
  it('package.json and Cargo.toml versions should match', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'),
    );
    const cargoToml = fs.readFileSync(path.join(__dirname, '../Cargo.toml'), 'utf8');

    const cargoVersionMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);

    expect(cargoVersionMatch).not.toBeNull();
    expect(cargoVersionMatch?.[1]).toBe(packageJson.version);
  });
});

// Base test case type
interface BaseTestCase {
  description: string;
}

// Distance metric test cases (levenshtein, damerau_osa, damerau_unrestricted, indel, lcs_seq)
interface DistanceTestCase extends BaseTestCase {
  input_a: string;
  input_b: string;
  expected_distance: number;
  expected_score: number;
  expected_similarity?: number;
}

// Jaro-Winkler test cases
interface JaroWinklerTestCase extends BaseTestCase {
  input_a: string;
  input_b: string;
  expected_score: number;
}

// Substring similarity test cases
interface SubstringTestCase extends BaseTestCase {
  needle: string;
  haystack: string;
  expected_score: number;
  expected_range?: { start: number; end: number };
}

// Normalization preset test cases
interface NormalizationTestCase extends BaseTestCase {
  input: string;
  preset: string;
  expected: string;
}

// Ratio test cases (ratio, partial_ratio, token_sort_ratio, token_set_ratio)
interface RatioTestCase extends BaseTestCase {
  input_a: string;
  input_b: string;
  expected_ratio: number;
}

// Extract one test cases
interface ExtractOneTestCase extends BaseTestCase {
  query: string;
  choices: string[];
  score_cutoff?: number;
  expected_choice: string | null;
  expected_index?: number;
}

// Extract test cases
interface ExtractTestCase extends BaseTestCase {
  query: string;
  choices: string[];
  score_cutoff?: number;
  limit?: number;
  expected_results: Array<{ choice: string; index: number }>;
}

// Unified distance test cases
interface UnifiedDistanceTestCase extends BaseTestCase {
  input_a: string;
  input_b: string;
  metric: string;
  expected: number;
}

// Unified score test cases
interface UnifiedScoreTestCase extends BaseTestCase {
  input_a: string;
  input_b: string;
  metric: string;
  expected: number;
}

// Suggestion test cases
interface SuggestionTestCase extends BaseTestCase {
  input: string;
  candidates: string[];
  options: {
    metric: string;
    normalize_preset?: string;
    preset?: string;
    min_score?: number;
    max_suggestions?: number;
    prefer_prefix?: boolean;
    jaro_prefix_scale?: number;
    jaro_max_prefix?: number;
  };
  expected: Array<{
    value: string;
    score: number;
    matched_range?: { start: number; end: number };
    normalized_value?: string;
  }>;
}

// Union type for all test cases
type TestCase =
  | DistanceTestCase
  | JaroWinklerTestCase
  | SubstringTestCase
  | NormalizationTestCase
  | RatioTestCase
  | ExtractOneTestCase
  | ExtractTestCase
  | UnifiedDistanceTestCase
  | UnifiedScoreTestCase
  | SuggestionTestCase;

interface FixtureDocument {
  version?: string;
  test_cases: Array<{
    category: string;
    cases: TestCase[];
  }>;
}

// Helper to convert snake_case metric names from fixtures to camelCase for API
// Returns string to be compatible with both DistanceMetric and SimilarityMetric
function toCamelCaseMetric(snakeCase: string): string {
  const mapping: Record<string, string> = {
    damerau_levenshtein: 'damerauLevenshtein',
    damerau_osa: 'damerauOsa',
    damerau_unrestricted: 'damerauUnrestricted',
    jaro_winkler: 'jaroWinkler',
    lcs_seq: 'lcsSeq',
    partial_ratio: 'partialRatio',
    token_sort_ratio: 'tokenSortRatio',
    token_set_ratio: 'tokenSetRatio',
  };
  return mapping[snakeCase] || snakeCase;
}

const fixturesRoot = path.join(__dirname, 'fixtures');

if (!fs.existsSync(fixturesRoot)) {
  throw new Error(`Fixture directory not found: ${fixturesRoot}`);
}

const fixtureDocuments: FixtureDocument[] = fs
  .readdirSync(fixturesRoot, { withFileTypes: true })
  .flatMap((entry) => {
    if (entry.isDirectory()) {
      const versionDir = path.join(fixturesRoot, entry.name);
      return fs.readdirSync(versionDir, { withFileTypes: true }).flatMap((subEntry) => {
        const subPath = path.join(versionDir, subEntry.name);
        if (subEntry.isDirectory()) {
          return fs
            .readdirSync(subPath)
            .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'))
            .map((file) => {
              const content = fs.readFileSync(path.join(subPath, file), 'utf8');
              return yaml.load(content) as FixtureDocument;
            });
        }

        if (
          subEntry.isFile() &&
          (subEntry.name.endsWith('.yaml') || subEntry.name.endsWith('.yml'))
        ) {
          const content = fs.readFileSync(subPath, 'utf8');
          return [yaml.load(content) as FixtureDocument];
        }

        return [];
      });
    }

    if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
      const content = fs.readFileSync(path.join(fixturesRoot, entry.name), 'utf8');
      return [yaml.load(content) as FixtureDocument];
    }

    return [];
  });

for (const document of fixtureDocuments) {
  for (const categoryGroup of document.test_cases) {
    const suiteName = document.version
      ? `${categoryGroup.category} (${document.version})`
      : categoryGroup.category;

    describe(suiteName, () => {
      for (const testCase of categoryGroup.cases) {
        it(testCase.description, () => {
          if (categoryGroup.category === 'levenshtein') {
            const tc = testCase as DistanceTestCase;
            expect(levenshtein(tc.input_a, tc.input_b)).toBe(tc.expected_distance);
            expect(normalized_levenshtein(tc.input_a, tc.input_b)).toBeCloseTo(
              tc.expected_score,
              10,
            );
          } else if (categoryGroup.category === 'damerau_osa') {
            const tc = testCase as DistanceTestCase;
            expect(osa_distance(tc.input_a, tc.input_b)).toBe(tc.expected_distance);
            expect(normalized_osa_similarity(tc.input_a, tc.input_b)).toBeCloseTo(
              tc.expected_score,
              10,
            );
          } else if (categoryGroup.category === 'damerau_unrestricted') {
            const tc = testCase as DistanceTestCase;
            expect(damerau_levenshtein(tc.input_a, tc.input_b)).toBe(tc.expected_distance);
            expect(normalized_damerau_levenshtein(tc.input_a, tc.input_b)).toBeCloseTo(
              tc.expected_score,
              10,
            );
          } else if (categoryGroup.category === 'jaro_winkler') {
            const tc = testCase as JaroWinklerTestCase;
            expect(jaro_winkler(tc.input_a, tc.input_b)).toBeCloseTo(tc.expected_score, 10);
          } else if (categoryGroup.category === 'substring') {
            const tc = testCase as SubstringTestCase;
            const result = substringSimilarity(tc.needle, tc.haystack);
            expect(result.score).toBeCloseTo(tc.expected_score, 10);
            if (tc.expected_range) {
              expect(result.candidateRange).toEqual([
                tc.expected_range.start,
                tc.expected_range.end,
              ]);
            } else {
              expect(result.candidateRange).toEqual([0, 0]);
            }
          } else if (categoryGroup.category === 'normalization_presets') {
            const tc = testCase as NormalizationTestCase;
            expect(normalize(tc.input, tc.preset as NormalizationPreset)).toBe(tc.expected);
          } else if (categoryGroup.category === 'suggestions') {
            const tc = testCase as SuggestionTestCase;
            const result = suggest(tc.input, tc.candidates, {
              metric: toCamelCaseMetric(tc.options.metric) as SuggestMetric,
              preset: (tc.options.normalize_preset ?? tc.options.preset) as NormalizationPreset,
              minScore: tc.options.min_score,
              maxSuggestions: tc.options.max_suggestions,
              preferPrefix: tc.options.prefer_prefix,
              jaroPrefixScale: tc.options.jaro_prefix_scale,
              jaroMaxPrefix: tc.options.jaro_max_prefix,
            });
            expect(result).toHaveLength(tc.expected.length);
            tc.expected.forEach((exp, i) => {
              expect(result[i].value).toBe(exp.value);
              expect(result[i].score).toBeCloseTo(exp.score, 10);
              if (exp.matched_range) {
                expect(result[i].matchedRange).toEqual(exp.matched_range);
              }
              if (exp.normalized_value) {
                expect(result[i].normalizedValue).toBe(exp.normalized_value);
              }
            });
          } else if (categoryGroup.category === 'ratio') {
            const tc = testCase as RatioTestCase;
            expect(ratio(tc.input_a, tc.input_b)).toBeCloseTo(tc.expected_ratio, 10);
          } else if (categoryGroup.category === 'partial_ratio') {
            const tc = testCase as RatioTestCase;
            expect(partialRatio(tc.input_a, tc.input_b)).toBeCloseTo(tc.expected_ratio, 10);
          } else if (categoryGroup.category === 'token_sort_ratio') {
            const tc = testCase as RatioTestCase;
            expect(tokenSortRatio(tc.input_a, tc.input_b)).toBeCloseTo(tc.expected_ratio, 10);
          } else if (categoryGroup.category === 'token_set_ratio') {
            const tc = testCase as RatioTestCase;
            expect(tokenSetRatio(tc.input_a, tc.input_b)).toBeCloseTo(tc.expected_ratio, 10);
          } else if (categoryGroup.category === 'indel') {
            const tc = testCase as DistanceTestCase;
            expect(indel_distance(tc.input_a, tc.input_b)).toBe(tc.expected_distance);
            expect(indel_normalized_similarity(tc.input_a, tc.input_b)).toBeCloseTo(
              tc.expected_score,
              10,
            );
          } else if (categoryGroup.category === 'lcs_seq') {
            const tc = testCase as DistanceTestCase;
            expect(lcs_seq_distance(tc.input_a, tc.input_b)).toBe(tc.expected_distance);
            expect(lcs_seq_similarity(tc.input_a, tc.input_b)).toBe(tc.expected_similarity);
            expect(lcs_seq_normalized_similarity(tc.input_a, tc.input_b)).toBeCloseTo(
              tc.expected_score,
              10,
            );
          } else if (categoryGroup.category === 'extract_one') {
            const tc = testCase as ExtractOneTestCase;
            const result = extractOne(tc.query, tc.choices, {
              scoreCutoff: tc.score_cutoff ?? 0,
            });
            if (tc.expected_choice === null) {
              expect(result).toBeNull();
            } else {
              expect(result).not.toBeNull();
              expect(result?.choice).toBe(tc.expected_choice);
              expect(result?.index).toBe(tc.expected_index);
            }
          } else if (categoryGroup.category === 'extract') {
            const tc = testCase as ExtractTestCase;
            const result = extract(tc.query, tc.choices, {
              scoreCutoff: tc.score_cutoff ?? 0,
              limit: tc.limit,
            });
            expect(result).toHaveLength(tc.expected_results.length);
            tc.expected_results.forEach((exp, i) => {
              expect(result[i].choice).toBe(exp.choice);
              expect(result[i].index).toBe(exp.index);
            });
          } else if (categoryGroup.category === 'unified_distance') {
            const tc = testCase as UnifiedDistanceTestCase;
            expect(
              distance(tc.input_a, tc.input_b, toCamelCaseMetric(tc.metric) as DistanceMetric),
            ).toBe(tc.expected);
          } else if (categoryGroup.category === 'unified_score') {
            const tc = testCase as UnifiedScoreTestCase;
            expect(
              score(tc.input_a, tc.input_b, toCamelCaseMetric(tc.metric) as SimilarityMetric),
            ).toBeCloseTo(tc.expected, 10);
          }
        });
      }
    });
  }
}

describe('API compatibility aliases', () => {
  it('normalizes snake_case distance metrics', () => {
    const osaDistance = distance('abcd', 'abdc', 'osa');
    const aliasDistance = distance('abcd', 'abdc', 'damerau_osa');
    expect(aliasDistance).toBe(osaDistance);

    const unrestricted = distance('abcd', 'badc', 'damerauLevenshtein');
    const unrestrictedAlias = distance('abcd', 'badc', 'damerau_unrestricted');
    expect(unrestrictedAlias).toBe(unrestricted);
  });

  it('normalizes snake_case similarity metrics', () => {
    const camelScore = score('test', 'testing', 'jaroWinkler');
    const snakeScore = score('test', 'testing', 'jaro_winkler');
    expect(snakeScore).toBeCloseTo(camelScore, 10);
  });

  it('accepts snake_case extract options', () => {
    const exact = extractOne('test', ['toast', 'test'], { score_cutoff: 100 });
    expect(exact?.choice).toBe('test');

    const results = extract('jets', ['New York Jets', 'Dallas Cowboys'], {
      score_cutoff: 30,
      limit: 1,
    });
    expect(results).toHaveLength(1);
    expect(results[0].choice).toBe('New York Jets');
  });

  it('accepts snake_case suggestion options and metrics', () => {
    const suggestions = suggest('hello world', ['world hello', 'hi there'], {
      metric: 'token_sort_ratio',
      min_score: 0.5,
      max_suggestions: 1,
      normalize_preset: 'default',
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].value).toBe('world hello');
  });
});
