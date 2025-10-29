# Suggestions API User Guide

## Overview

The Suggestions API provides "did you mean?" functionality for CLI tools, fuzzy search, and typo
correction by ranking candidate strings against user input. It combines multiple string similarity
metrics with normalization and scoring strategies to return the most relevant matches.

## Purpose

When users make typos or provide partial input, the Suggestions API helps you:

- **Correct typos** in command-line interfaces
- **Fuzzy match** file paths and commands
- **Suggest alternatives** with configurable scoring thresholds
- **Rank results** by similarity with optional prefix bonuses

## Core Behavior

**Input**: User's typed string + list of valid candidates **Output**: Ranked list of best matches
with scores

### Algorithm

1. **Normalize** input & candidates using configurable preset
2. **Score** each candidate using selected metric
3. **Apply** optional prefix bonus (10% boost for prefix matches)
4. **Filter** by minimum score threshold
5. **Sort** by score (descending), then alphabetically for ties
6. **Return** top N suggestions

## API Reference

```typescript
import { suggest } from 'string-metrics-wasm';

const suggestions = suggest(userInput, candidates, options);
```

### Parameters

| Parameter    | Type                | Default      | Description                             |
| ------------ | ------------------- | ------------ | --------------------------------------- |
| `userInput`  | `string`            | _(required)_ | The string typed by the user            |
| `candidates` | `string[]`          | _(required)_ | Array of valid options to match against |
| `options`    | `SuggestionOptions` | `{}`         | Configuration options (see below)       |

### Options

| Option              | Type      | Default          | Description                                                                                            |
| ------------------- | --------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| `min_score`         | `number`  | `0.6`            | Score threshold (0.0-1.0). Balance precision vs. recall                                                |
| `max_suggestions`   | `number`  | `5`              | Limit results to avoid overwhelming users                                                              |
| `metric`            | `string`  | `'jaro_winkler'` | Algorithm: `'levenshtein'`, `'damerau_osa'`, `'damerau_unrestricted'`, `'jaro_winkler'`, `'substring'` |
| `normalize_preset`  | `string`  | `'default'`      | Text normalization: `'none'`, `'minimal'`, `'default'`, `'aggressive'`                                 |
| `prefer_prefix`     | `boolean` | `false`          | Boost scores for prefix matches by 10%                                                                 |
| `jaro_prefix_scale` | `number`  | `0.1`            | Jaro-Winkler prefix scaling (only for `jaro_winkler` metric)                                           |
| `jaro_max_prefix`   | `number`  | `4`              | Max prefix length for Jaro-Winkler (only for `jaro_winkler` metric)                                    |

### Return Value

Returns an array of `Suggestion` objects:

```typescript
interface Suggestion {
  value: string; // Original candidate string
  score: number; // Similarity score [0.0, 1.0]
  matchedRange?: {
    // Optional: for substring metric
    start: number;
    end: number;
  };
  normalized_value?: string; // Optional: result after normalization
  reason?: string; // Optional: explanation (e.g., "prefix_bonus")
}
```

## Metric Selection Guide

### Levenshtein (`'levenshtein'`)

- **Use for**: General-purpose typo correction
- **Strengths**: Handles insertions, deletions, substitutions
- **Example**: "docscrib" → "docscribe" (score: 0.889)
- **Best for**: CLI command typos, general fuzzy matching

### Damerau OSA (`'damerau_osa'`)

- **Use for**: CLI fuzzy matching with transpositions
- **Strengths**: Handles character swaps (e.g., "teh" → "the")
- **Performance**: Fast, good for interactive use
- **Best for**: Real-time suggestions, keyboard typos

### Damerau Unrestricted (`'damerau_unrestricted'`)

- **Use for**: Complex transposition scenarios
- **Strengths**: Allows multiple swaps in one word
- **Best for**: Advanced typo correction

### Jaro-Winkler (`'jaro_winkler'`)

- **Use for**: Short strings, prefix-sensitive matching
- **Strengths**: Emphasizes prefix similarity
- **Example**: "test" → "testing" (higher score than "best")
- **Best for**: Command names, identifiers

### Substring (`'substring'`)

- **Use for**: Partial matches, path/command suggestions
- **Strengths**: Finds longest common substring
- **Returns**: `matchedRange` showing where match occurs
- **Example**: "schem" → "schemas" with range [0, 5]
- **Best for**: File path completion, partial command matching

## Normalization Presets

| Preset         | Transformations                                       | Use Case                       |
| -------------- | ----------------------------------------------------- | ------------------------------ |
| `'none'`       | No changes                                            | Case-sensitive, exact matching |
| `'minimal'`    | NFC normalization + trim                              | Unicode-safe, preserve case    |
| `'default'`    | NFC + lowercase + trim                                | Most CLI tools (recommended)   |
| `'aggressive'` | NFKD + lowercase + strip accents + remove punctuation | Maximum fuzzy matching         |

## Example Use Cases

### 1. CLI Typo Correction

```typescript
import { suggest } from 'string-metrics-wasm';

const userInput = 'docscrib';
const commands = ['docscribe', 'crucible-shim', 'config-path-api', 'foundry'];

const suggestions = suggest(userInput, commands, {
  min_score: 0.6,
  metric: 'levenshtein',
  normalize_preset: 'default',
});

console.log(suggestions);
// [{ value: 'docscribe', score: 0.889 }]
```

**Result**: Suggests "docscribe" as the most likely intended command.

### 2. Path Fuzzy Matching

```typescript
const userInput = 'schem';
const paths = ['schemas', 'schema-validation', 'config-path-api'];

const suggestions = suggest(userInput, paths, {
  min_score: 0.5,
  max_suggestions: 2,
  metric: 'substring',
  normalize_preset: 'default',
});

console.log(suggestions);
// [{
//   value: 'schemas',
//   score: 0.833,
//   matchedRange: { start: 0, end: 5 }
// }]
```

**Result**: Finds "schemas" with the matched range showing where "schem" appears.

### 3. Unicode Normalization Impact

```typescript
const userInput = 'Café';
const options = ['café', 'cache', 'config'];

const suggestions = suggest(userInput, options, {
  min_score: 0.6,
  max_suggestions: 2,
  metric: 'levenshtein',
  normalize_preset: 'aggressive', // Strips accents
});

console.log(suggestions);
// [
//   { value: 'café', score: 1.0 },   // Perfect match after accent stripping
//   { value: 'cache', score: 0.6 }
// ]
```

**Result**: With aggressive normalization, "Café" matches "café" perfectly (both become "cafe").

### 4. Jaro-Winkler with Prefix Preference

```typescript
const userInput = 'test';
const candidates = ['testing', 'tested', 'best'];

const suggestions = suggest(userInput, candidates, {
  min_score: 0.6,
  max_suggestions: 3,
  metric: 'jaro_winkler',
  normalize_preset: 'default',
  prefer_prefix: true, // Boost prefix matches by 10%
});

console.log(suggestions);
// [
//   { value: 'tested', score: 0.940 },   // Prefix match, boosted
//   { value: 'testing', score: 0.923 },  // Prefix match, boosted
//   { value: 'best', score: 0.833 }      // No prefix match
// ]
```

**Result**: "tested" and "testing" score higher because they start with "test". The prefix bonus
adds ~10% boost: `score + (1 - score) * 0.1`.

## Advanced Usage

### Custom Scoring Thresholds

Balance precision (fewer, better matches) vs. recall (more matches):

```typescript
// High precision: Only very close matches
const strict = suggest(input, candidates, { min_score: 0.9 });

// High recall: Include distant matches
const lenient = suggest(input, candidates, { min_score: 0.4 });
```

### Combining Metrics

For complex scenarios, you can run multiple suggestion queries:

```typescript
// Try exact/prefix first, then fuzzy
const exactMatches = suggest(input, candidates, {
  metric: 'jaro_winkler',
  prefer_prefix: true,
  min_score: 0.9,
});

if (exactMatches.length === 0) {
  const fuzzyMatches = suggest(input, candidates, {
    metric: 'levenshtein',
    min_score: 0.6,
  });
}
```

## Cross-Language Compatibility

The Suggestions API is designed for consistent behavior across multiple language implementations.
Test fixtures validate identical behavior across:

- **TypeScript/WASM** (this library)
- **Python** (via [pyfulmen](https://github.com/fulmenhq/pyfulmen))
- **Go** (via [gofulmen](https://github.com/fulmenhq/gofulmen))

All implementations use the same:

- Score precision (16 decimal places)
- Sorting rules (score descending, then alphabetical)
- Normalization presets
- Edge case handling (empty input, no matches, etc.)

**Downstream Consumer**: The [Crucible](https://github.com/fulmenhq/crucible) project uses this
library for cross-language test fixture validation.

## Performance Tips

1. **Choose the right metric**: `damerau_osa` is fastest for interactive use
2. **Limit candidates**: Pre-filter candidates when possible
3. **Adjust `max_suggestions`**: Fewer results = faster response
4. **Use appropriate normalization**: `'none'` is fastest, `'aggressive'` is slowest

## Troubleshooting

### No suggestions returned

- Check `min_score` threshold (try lowering it)
- Verify candidates array is not empty
- Check normalization preset (aggressive preset may normalize away differences)

### Wrong suggestions

- Try different metrics (e.g., `substring` for partial matches)
- Adjust normalization preset
- Enable `prefer_prefix` for command-like inputs

### Score seems wrong

- Scores are normalized to [0.0, 1.0] range
- Different metrics use different algorithms
- Prefix bonus adds up to 10% to base score

## See Also

- [Normalization Guide](./normalization.md) - Details on normalization presets
- [Metrics Comparison](./metrics.md) - Deep dive into each metric algorithm
- [API Reference](../api/README.md) - Complete API documentation
