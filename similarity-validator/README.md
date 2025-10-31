# Similarity Validator

**Thin shim CLI tool** that generates and validates similarity metrics fixtures using the canonical
rapidfuzz-rs implementation as the source of truth.

## Purpose

This tool is a **canonical value generator**, NOT a test tool:

1. **Generate Mode**: Computes expected values by directly calling rapidfuzz-rs, writes to fixtures
2. **Validate Mode**: Verifies fixture expected values match rapidfuzz-rs computations exactly
3. **Zero Custom Logic**: Pure passthrough to rapidfuzz-rs - no algorithms implemented here

**Key Principle**: This validator IS the test oracle. It has no tests of its own because it directly
delegates to rapidfuzz-rs, which is our canonical source of truth.

## Why This Architecture?

- **Single Source of Truth**: rapidfuzz-rs is the canonical implementation - we don't duplicate
  logic
- **Correctness Guarantee**: TypeScript/WASM implementation verified against same library it wraps
- **Cross-Language Compatibility**: Fixtures work across Python (pyfulmen), TypeScript
  (string-metrics-wasm), and future implementations
- **Maintainability**: When rapidfuzz-rs updates, regenerate fixtures for new expected values

## Building

From the repository root:

```bash
make build-validator
```

This builds the binary to `dist/similarity-validator`.

## Usage

### Validate Fixtures

Validate all fixture files matching a glob pattern:

```bash
./dist/similarity-validator validate 'tests/fixtures/**/*.yaml'
```

Or use the Makefile target:

```bash
make validate-fixtures
```

### Help

```bash
./dist/similarity-validator --help
./dist/similarity-validator --version
```

## Output

The tool provides colored output:

- ✅ Green checkmarks for passing tests
- ❌ Red X marks for failures
- Detailed failure information including expected vs actual values

Example output:

```
Validating fixtures matching: tests/fixtures/**/*.yaml

================================================================================
SUMMARY
================================================================================
Files processed: 6
Total tests:     45
Passed:          45
Failed:          0

All tests passed!
```

## Fixture Format

Fixtures must follow the Crucible v2.0.0 similarity schema:

```yaml
$schema: https://schemas.fulmenhq.dev/library/foundry/v2.0.0/similarity.schema.json
version: 2025.10.3
test_cases:
  - category: levenshtein
    cases:
      - input_a: kitten
        input_b: sitting
        expected_distance: 3
        expected_score: 0.5714285714285714
        description: Classic Levenshtein example
        tags:
          - standard
```

## Supported Categories

### Core Metrics (validated by rapidfuzz-rs)

- `levenshtein` - Levenshtein distance and normalized score
- `damerau_osa` - Optimal String Alignment (restricted Damerau-Levenshtein)
- `damerau_unrestricted` - True Damerau-Levenshtein
- `jaro_winkler` - Jaro-Winkler similarity
- `indel` - Indel distance (insertions/deletions only)
- `lcs_seq` - Longest Common Subsequence
- `ratio` - Fuzzy ratio (0-100 scale)
- `unified_distance` - Unified distance API (multiple metrics)
- `unified_score` - Unified score API (multiple metrics)
- `normalization_presets` - Normalization preset transformations
- `substring` - Substring similarity (LCS-based)
- `suggestions` - Suggestion API with scoring and ranking

### TypeScript-Only Categories (skipped by validator)

- `partial_ratio`, `token_sort_ratio`, `token_set_ratio` - Token-based fuzzy matching
- `extract`, `extract_one` - Process helpers for finding best matches

TypeScript-only categories are intentionally skipped by the validator since they have no
rapidfuzz-rs equivalent. These are validated by the TypeScript test suite instead.

## Integration with CI

Add to your CI workflow:

```yaml
- name: Validate fixtures
  run: make validate-fixtures
```

This ensures fixtures remain accurate across code changes.

## Testing Philosophy

**Why there are no tests for the validator itself:**

The validator is a **thin shim** with zero custom logic. It's a direct passthrough to rapidfuzz-rs
functions:

```rust
// Example from validator code
fn validate_levenshtein(...) -> ValidationResult {
    let actual_distance = rapidfuzz::distance::levenshtein::distance(a.chars(), b.chars());
    // Compare actual_distance to expected_distance from fixture
    // No custom algorithms, just direct delegation
}
```

Testing the validator would mean testing rapidfuzz-rs, which already has its own comprehensive test
suite. The validator IS the test oracle for our TypeScript implementation.

## Generate Mode

To regenerate fixture expected values after rapidfuzz-rs updates:

```bash
# Regenerate specific fixture
./dist/similarity-validator generate --input tests/fixtures/v2.0.0/basic.yaml --overwrite

# Or use Makefile (regenerates all fixtures)
make generate-fixtures
```

This updates all `expected_distance` and `expected_score` values using current rapidfuzz-rs
computations.

## Future Enhancements

Potential improvements:

- ✅ ~~Generate mode: Create fixtures from input pairs~~ (Implemented)
- ✅ ~~Support for normalization/substring/suggestions validation~~ (Implemented)
- JSON output format for CI integration
- Parallel processing for large fixture sets
- Performance metrics and timing information
