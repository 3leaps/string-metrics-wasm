import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  damerau_levenshtein,
  jaro_winkler,
  levenshtein,
  normalize,
  normalized_osa_similarity,
  normalized_damerau_levenshtein,
  normalized_levenshtein,
  osa_distance,
  substringSimilarity,
  suggest,
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

interface FixtureDocument {
  version?: string;
  test_cases: Array<{
    category: string;
    cases: unknown[];
  }>;
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
            expect(levenshtein(testCase.input_a, testCase.input_b)).toBe(
              testCase.expected_distance,
            );
            expect(normalized_levenshtein(testCase.input_a, testCase.input_b)).toBeCloseTo(
              testCase.expected_score,
              10,
            );
          } else if (categoryGroup.category === 'damerau_osa') {
            expect(osa_distance(testCase.input_a, testCase.input_b)).toBe(
              testCase.expected_distance,
            );
            expect(normalized_osa_similarity(testCase.input_a, testCase.input_b)).toBeCloseTo(
              testCase.expected_score,
              10,
            );
          } else if (categoryGroup.category === 'damerau_unrestricted') {
            expect(damerau_levenshtein(testCase.input_a, testCase.input_b)).toBe(
              testCase.expected_distance,
            );
            expect(normalized_damerau_levenshtein(testCase.input_a, testCase.input_b)).toBeCloseTo(
              testCase.expected_score,
              10,
            );
          } else if (categoryGroup.category === 'jaro_winkler') {
            expect(jaro_winkler(testCase.input_a, testCase.input_b)).toBeCloseTo(
              testCase.expected_score,
              10,
            );
          } else if (categoryGroup.category === 'substring') {
            const result = substringSimilarity(testCase.needle, testCase.haystack);
            expect(result.score).toBeCloseTo(testCase.expected_score, 10);
            if (testCase.expected_range) {
              expect(result.candidateRange).toEqual([
                testCase.expected_range.start,
                testCase.expected_range.end,
              ]);
            } else {
              expect(result.candidateRange).toEqual([0, 0]);
            }
          } else if (categoryGroup.category === 'normalization_presets') {
            expect(normalize(testCase.input, testCase.preset)).toBe(testCase.expected);
          } else if (categoryGroup.category === 'suggestions') {
            const result = suggest(testCase.input, testCase.candidates, {
              metric: testCase.options.metric,
              preset: testCase.options.normalize_preset ?? testCase.options.preset,
              min_score: testCase.options.min_score,
              max_suggestions: testCase.options.max_suggestions,
              prefer_prefix: testCase.options.prefer_prefix,
              jaro_prefix_scale: testCase.options.jaro_prefix_scale,
              jaro_max_prefix: testCase.options.jaro_max_prefix,
            });
            expect(result).toHaveLength(testCase.expected.length);
            testCase.expected.forEach(
              (
                exp: {
                  value: string;
                  score: number;
                  matched_range?: { start: number; end: number };
                  normalized_value?: string;
                },
                i: number,
              ) => {
                expect(result[i].value).toBe(exp.value);
                expect(result[i].score).toBeCloseTo(exp.score, 10);
                if (exp.matched_range) {
                  expect(result[i].matchedRange).toEqual(exp.matched_range);
                }
                if (exp.normalized_value) {
                  expect(result[i].normalized_value).toBe(exp.normalized_value);
                }
              },
            );
          }
        });
      }
    });
  }
}
