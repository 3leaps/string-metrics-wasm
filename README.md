# string-metrics-wasm

High-performance string similarity and fuzzy matching via WASM bindings to
[rapidfuzz-rs](https://github.com/rapidfuzz/rapidfuzz-rs).

## Description

This library provides blazing-fast string similarity metrics through WASM bindings to the Rust
[rapidfuzz-rs](https://github.com/rapidfuzz/rapidfuzz-rs) library, plus TypeScript implementations
of advanced fuzzy matching algorithms. It combines the performance of compiled Rust/WASM with the
flexibility of TypeScript for a comprehensive text similarity toolkit.

**Features:**

- **WASM-powered distance metrics**: Levenshtein, Damerau-Levenshtein, OSA, Jaro, Jaro-Winkler,
  Indel, LCS
- **Fuzzy matching**: Token-based comparison (order-insensitive, set-based)
- **Process helpers**: Find best matches from arrays with configurable scoring
- **Unified API**: Consistent interface across all metrics
- **TypeScript extensions**: Substring similarity, normalization presets, suggestions API
- **Multi-runtime**: Node.js, Bun, Deno support

## Prerequisites

1. Rust toolchain via [rustup](https://rustup.rs/)
2. `wasm-pack` (pinned to the version we build against)

Install `wasm-pack` once per machine:

```bash
cargo install wasm-pack --version 0.13.1
```

## Installation

```bash
npm install string-metrics-wasm
```

## Quick Start

```typescript
import { levenshtein, ratio, tokenSortRatio, extractOne, score } from 'string-metrics-wasm';

// Basic edit distance
const dist = levenshtein('kitten', 'sitting');
console.log(dist); // 3

// Fuzzy matching (0-100 scale)
const fuzzy = ratio('hello', 'hallo');
console.log(fuzzy); // 80.0

// Order-insensitive comparison
const tokens = tokenSortRatio('new york mets', 'mets york new');
console.log(tokens); // 100.0

// Find best match from array
const choices = ['Atlanta Falcons', 'New York Jets', 'Dallas Cowboys'];
const best = extractOne('new york', choices);
console.log(best); // { choice: 'New York Jets', score: 57.14, index: 1 }

// Unified scoring API (0-1 scale)
const similarity = score('hello', 'world', 'jaroWinkler');
console.log(similarity); // 0.4666...
```

## API Documentation

### Distance Metrics (WASM)

Edit distance metrics return raw integer distances (lower = more similar):

#### `levenshtein(a: string, b: string): number`

Minimum edits (insertions, deletions, substitutions) to transform `a` into `b`.

```typescript
levenshtein('kitten', 'sitting'); // 3
```

#### `damerau_levenshtein(a: string, b: string): number`

Levenshtein + transpositions (unrestricted).

```typescript
damerau_levenshtein('abcd', 'abdc'); // 1
```

#### `osa_distance(a: string, b: string): number`

Optimal String Alignment (restricted Damerau-Levenshtein).

```typescript
osa_distance('abcd', 'abdc'); // 1
```

#### `indel_distance(a: string, b: string): number`

Insertions and deletions only (no substitutions).

```typescript
indel_distance('hello', 'hallo'); // 2
```

#### `lcs_seq_distance(a: string, b: string): number`

Longest Common Subsequence distance.

```typescript
lcs_seq_distance('AGGTAB', 'GXTXAYB'); // 3
```

### Similarity Metrics (WASM)

Normalized similarity scores (0.0-1.0 scale, higher = more similar):

#### `normalized_levenshtein(a: string, b: string): number`

Normalized Levenshtein similarity.

```typescript
normalized_levenshtein('kitten', 'sitting'); // 0.5714
```

#### `jaro(a: string, b: string): number`

Jaro similarity.

```typescript
jaro('kitten', 'sitting'); // 0.7460
```

#### `jaro_winkler(a: string, b: string): number`

Jaro-Winkler similarity (boosts prefix matches).

```typescript
jaro_winkler('kitten', 'sitting'); // 0.7460
```

#### `indel_normalized_similarity(a: string, b: string): number`

Normalized indel similarity.

```typescript
indel_normalized_similarity('hello', 'hallo'); // 0.8
```

#### `lcs_seq_normalized_similarity(a: string, b: string): number`

Normalized LCS similarity.

```typescript
lcs_seq_normalized_similarity('AGGTAB', 'GXTXAYB'); // 0.5714
```

### Fuzzy Matching (WASM + TypeScript)

Fuzzy string comparison metrics (0-100 scale):

#### `ratio(a: string, b: string): number` (WASM)

Basic fuzzy similarity using Indel distance.

```typescript
ratio('kitten', 'sitting'); // 61.54
```

#### `partialRatio(a: string, b: string): number` (TypeScript)

Best matching substring using sliding window.

```typescript
partialRatio('fuzzy', 'fuzzy wuzzy was a bear'); // 100.0
```

#### `tokenSortRatio(a: string, b: string): number` (TypeScript)

Order-insensitive token comparison (sorts tokens first).

```typescript
tokenSortRatio('new york mets', 'mets york new'); // 100.0
```

#### `tokenSetRatio(a: string, b: string): number` (TypeScript)

Set-based token comparison (handles duplicates and order).

```typescript
tokenSetRatio('hello world world', 'world hello'); // 100.0
```

### Process Helpers (TypeScript)

Find best matches from arrays:

#### `extractOne(query: string, choices: string[], options?): ExtractResult | null`

Find the single best match.

**Options:**

- `scorer?: (a: string, b: string) => number` - Scoring function (default: `ratio`)
- `processor?: (str: string) => string` - Preprocessing function
- `scoreCutoff?: number` - Minimum score threshold (default: 0)

```typescript
const choices = ['Atlanta Falcons', 'New York Jets', 'Dallas Cowboys'];
const best = extractOne('jets', choices, { scoreCutoff: 30 });
// { choice: 'New York Jets', score: 35.29, index: 1 }
```

#### `extract(query: string, choices: string[], options?): ExtractResult[]`

Find top N matches (sorted by score).

**Options:**

- `scorer?: (a: string, b: string) => number` - Scoring function
- `processor?: (str: string) => string` - Preprocessing function
- `scoreCutoff?: number` - Minimum score threshold
- `limit?: number` - Maximum results to return

```typescript
const results = extract('new york', choices, { limit: 2, scoreCutoff: 40 });
// [
//   { choice: 'New York Jets', score: 57.14, index: 1 },
//   { choice: 'New York Giants', score: 52.17, index: 2 }
// ]
```

### Unified API (TypeScript)

Metric-selectable interface with consistent scales:

#### `distance(a: string, b: string, metric?: DistanceMetric): number`

Calculate edit distance using any metric (returns raw distance).

**Supported metrics:** `'levenshtein'` (default), `'damerauLevenshtein'`, `'osa'`, `'indel'`,
`'lcsSeq'`

```typescript
distance('hello', 'world'); // 4 (default: levenshtein)
distance('hello', 'world', 'indel'); // 8
```

#### `score(a: string, b: string, metric?: SimilarityMetric): number`

Calculate similarity using any metric (returns 0-1 normalized score).

**Supported metrics:** `'jaroWinkler'` (default), `'levenshtein'`, `'damerauLevenshtein'`, `'osa'`,
`'jaro'`, `'indel'`, `'lcsSeq'`, `'ratio'`, `'partialRatio'`, `'tokenSortRatio'`, `'tokenSetRatio'`

```typescript
score('hello', 'world'); // 0.4666... (default: jaroWinkler)
score('new york mets', 'mets york new', 'tokenSortRatio'); // 1.0
```

### Normalization & Suggestions

#### `normalize(input: string, preset?: NormalizationPreset): string`

Normalize text for comparison.

**Presets:** `'none'`, `'minimal'`, `'default'`, `'aggressive'`

```typescript
normalize('Naïve Café', 'default'); // 'naive cafe'
```

#### `suggest(query: string, candidates: string[], options?): Suggestion[]`

Get ranked suggestions with detailed scoring.

```typescript
const suggestions = suggest('pythn', ['python', 'java', 'javascript'], {
  metric: 'jaroWinkler',
  minScore: 0.6,
  maxSuggestions: 3,
});
// [
//   { value: 'python', score: 0.9555, ... },
//   ...
// ]
```

See [Suggestions API docs](docs/user-guide/suggestions-api.md) for full details.

## Implementation Details

### WASM vs TypeScript

This library uses a hybrid approach for optimal performance and flexibility:

**WASM Implementations** (fastest):

- Core distance metrics: `levenshtein`, `damerau_levenshtein`, `osa_distance`, `jaro`,
  `jaro_winkler`
- RapidFuzz metrics: `ratio`, `indel_*`, `lcs_seq_*`

**TypeScript Implementations** (flexible):

- Token-based fuzzy matching: `partialRatio`, `tokenSortRatio`, `tokenSetRatio`
- Process helpers: `extractOne`, `extract`
- Unified API: `distance()`, `score()`
- Suggestions and normalization

Token-based metrics benefit from TypeScript's array operations and avoid WASM serialization
overhead. The unified API provides a convenient abstraction over both WASM and TypeScript
implementations.

### Supported Runtimes

- **Node.js** 16+ (ESM and CommonJS)
- **Bun** (native ESM support)
- **Deno** (use `npm:` specifier)

## Building from Source

1. Install dependencies and tooling: `make bootstrap`
2. Build WASM: `npm run build:wasm` or `make build`
3. Build TS: `npm run build:ts`

## Development

This project uses a Makefile for common tasks:

```bash
make help           # Show all available targets
make build          # Build WASM and TypeScript (with version check)
make test           # Run tests
make clean          # Remove build artifacts

# Code quality
make quality        # Run all quality checks (format-check, lint, rust checks)
make format         # Format all code (Biome + Prettier + rustfmt)
make format-check   # Check formatting without changes
make lint           # Lint TypeScript code with Biome
make lint-fix       # Lint and auto-fix TypeScript code

# Version management
make version-check  # Verify package.json and Cargo.toml versions match
make bump-patch     # Bump patch version (0.1.0 -> 0.1.1)
make bump-minor     # Bump minor version (0.1.0 -> 0.2.0)
make bump-major     # Bump major version (0.1.0 -> 1.0.0)
make set-version VERSION=x.y.z  # Set explicit version
```

Additional notes for contributors live in [`docs/development.md`](docs/development.md).

### Code Quality Tools

This project uses modern, fast tooling for code quality:

- **TypeScript/JavaScript**: [Biome](https://biomejs.dev/) for linting and formatting
- **JSON/YAML/Markdown**: [Prettier](https://prettier.io/) for formatting
- **Rust**: `rustfmt` for formatting, `clippy` for linting

Run `make quality` before committing to ensure all checks pass.

### Version Management

This project maintains version sync between `package.json` (npm) and `Cargo.toml` (Rust). The
Makefile provides targets to bump versions and keep them in sync. Additionally, the test suite
includes a version consistency check that will fail if versions drift.

**Important**: Always use `make bump-*` or `make set-version` commands to update versions. This
ensures both files stay synchronized.

## Performance

All string comparison operations complete in **< 1ms**:

- WASM metrics: **0.0003-0.0005ms** per operation
- Token-based metrics: **0.0003-0.0017ms** per operation
- Process helpers: **0.0008-0.001ms** per operation
- Unified API: **minimal dispatch overhead**

Run `node benchmark-phase1b.js` for detailed benchmarks.

## Testing

This project includes comprehensive test coverage:

- **115 unit tests** covering all functions
- **80 YAML fixture test cases** for reproducibility
- **100% regression-free** across all releases

Run tests with `npm test` or `make test`.

## Related Projects

- [rapidfuzz-rs](https://github.com/rapidfuzz/rapidfuzz-rs) - Rust implementation of RapidFuzz
- [rapidfuzz](https://github.com/rapidfuzz/RapidFuzz) - Original Python implementation
- [strsim-rs](https://github.com/dguo/strsim-rs) - String similarity metrics (deprecated in favor of
  rapidfuzz-rs)

## Versioning

This project follows [Semantic Versioning](https://semver.org/). Version history is maintained in
[CHANGELOG.md](CHANGELOG.md).

**Current Status**: v0.3.0 - Active development with expanded RapidFuzz surface area.

## License

This project is licensed under the [MIT License](LICENSE).

## Contributing

Contributions welcome! Please see our contributing guidelines:

- **Development setup:** [docs/development.md](docs/development.md)
- **Release workflow (maintainers):** [docs/publishing.md](docs/publishing.md)

## Governance

- Authoritative policies repository: https://github.com/3leaps/oss-policies/
- Code of Conduct: https://github.com/3leaps/oss-policies/blob/main/CODE_OF_CONDUCT.md
- Security Policy: https://github.com/3leaps/oss-policies/blob/main/SECURITY.md
- Contributing Guide: https://github.com/3leaps/oss-policies/blob/main/CONTRIBUTING.md

---

---

<div align="center">

⚡ **Fast Strings. Accurate Matches.** ⚡

_High-performance text similarity for modern TypeScript applications_

<br><br>

**Built with ⚡ by the 3 Leaps team**

**String Metrics** • **Fuzzy Matching** • **WASM Performance**

</div>
