# Similarity Validator

CLI tool to validate similarity metrics fixtures against the canonical strsim-rs implementation.

## Purpose

This tool ensures that:

1. Test fixtures are valid and match the Crucible schema
2. Expected values in fixtures match strsim-rs computations
3. Cross-language compatibility is maintained (Python rapidfuzz ↔ Rust strsim)

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

- `levenshtein` - Levenshtein distance and normalized score
- `damerau_osa` - Optimal String Alignment (restricted Damerau-Levenshtein)
- `damerau_unrestricted` - True Damerau-Levenshtein
- `jaro_winkler` - Jaro-Winkler similarity

Note: `normalization_presets`, `substring`, and `suggestions` categories are **not yet implemented**
in the validator (they test TypeScript-only features).

## Integration with CI

Add to your CI workflow:

```yaml
- name: Validate fixtures
  run: make validate-fixtures
```

This ensures fixtures remain accurate across code changes.

## Future Enhancements

Planned features:

- Generate mode: Create fixtures from input pairs
- Custom tolerance for floating-point comparisons
- Support for normalization/substring/suggestions validation
- JSON output format for CI integration
- Parallel processing for large fixture sets
