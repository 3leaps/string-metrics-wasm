# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.5] - 2025-10-31

### Changed

- **Package scope** - Changed package name from `string-metrics-wasm` to
  `@3leaps/string-metrics-wasm`
  - Install with: `npm install @3leaps/string-metrics-wasm`
  - Import unchanged: `import { ... } from '@3leaps/string-metrics-wasm'`
  - Published under 3leaps organization on npm

[0.3.5]: https://github.com/3leaps/string-metrics-wasm/compare/v0.3.4...v0.3.5

## [0.3.4] - 2025-10-31

### Added

- **Test coverage infrastructure**
  - Integrated `@vitest/coverage-v8` for comprehensive coverage tracking
  - `vitest.config.ts` with enforced coverage thresholds (90/90/90/70)
  - `make test-coverage` target for detailed coverage reports
  - `npm run test:coverage` script
  - Current coverage: 92%+ statements/lines/functions, 71% branches (exceeds all targets)
- **AI Developer Guide (AGENTS.md)**
  - Comprehensive guide for AI-assisted development
  - Mandatory reading list and session startup protocol
  - Detailed DO/DO-NOT operational guidelines
  - Test requirements and quality standards documentation
  - Git operation safety protocols and push authorization requirements
  - Makefile rationale and API naming conventions
  - Pre-commit checklist and commit attribution guidelines
- **Fixture validator enhancements** (Phase 1 completion)
  - Added support for `indel`, `lcs_seq`, `ratio` categories
  - Added support for `unified_distance` and `unified_score` categories
  - All 114 fixture tests now passing and validated against rapidfuzz-rs
  - TypeScript-only categories (token metrics, process helpers) appropriately skipped
  - Re-enabled fixture validation in pre-push hook
- **Enhanced documentation**
  - `docs/README.md` - Documentation hub with navigation guide
  - `docs/development.md` - Added comprehensive "Fixture Validation & Canonical Source of Truth"
    section
  - Thin shim architecture documentation with ASCII diagrams
  - Clear explanation of validator as canonical value generator
  - Table showing what gets tested where (Rust vs TypeScript)
  - `similarity-validator/README.md` - Enhanced with testing philosophy and architecture explanation

### Changed

- **BREAKING: camelCase API convention** with backward compatibility
  - All option fields now use camelCase: `scoreCutoff`, `minScore`, `maxSuggestions`,
    `normalizePreset`, etc.
  - All metric identifiers use camelCase: `jaroWinkler`, `damerauLevenshtein`, `partialRatio`, etc.
  - All result fields use camelCase: `normalizedValue`, `matchedRange`, etc.
  - **Backward Compatibility**: snake_case variants accepted as aliases (auto-converted internally)
  - See README.md for full API reference with new naming
- **Line ending normalization**
  - Enforced LF line endings across all platforms via `.gitattributes`
  - Applied rustfmt to validator code for consistency

### Fixed

- **TypeScript type errors in test suite**
  - Added comprehensive interfaces for all fixture test case types
  - Added proper type assertions for YAML fixture data
  - Fixed metric name and normalization preset type conversions
  - All 119 tests pass with zero TypeScript errors

### Developer Experience

- **make test-coverage** - New target for coverage reports with threshold enforcement
- **Fixture validation** - Now runs in pre-push hook (all 114 tests passing)
- **Documentation** - Clear thin shim pattern explanation for maintainers and AI developers
- **Version sync** - Cargo.toml and package.json remain synchronized

### Technical Details

- **Coverage**: 92.28% statements/lines, 97.14% functions, 71.42% branches
- **Tests**: 119 TypeScript unit tests + 114 fixture validator tests = 233 total tests
- **Bundle size**: No change from v0.3.0 (226 KB, 30 KB packaged)
- **Validator**: 1,462 lines of Rust (thin shim to rapidfuzz-rs)

[0.3.4]: https://github.com/3leaps/string-metrics-wasm/compare/v0.3.0...v0.3.4

## [0.3.1] - TBD

- **License compliance checking**
  - `scripts/check-licenses.js` - Automated license scanner for production dependencies
  - Blocks copyleft licenses (GPL, LGPL, AGPL, SSPL, EUPL, OSL, CDDL, EPL)
  - Allows permissive licenses (MIT, ISC, Apache-2.0, BSD, CC0, Unlicense)
  - `npm run license:check` script
  - Integrated into pre-push git hook
- **TypeScript type checking**
  - `npm run typecheck` script (tsc --noEmit)
  - `make typecheck` Makefile target
  - Integrated into `make quality` checks
  - Added to pre-commit hook for fast feedback
- **Git hooks with husky**
  - Pre-commit: format, lint, typecheck, rust checks
  - Pre-push: version check, license check, quality, build, tests, fixtures
  - Automated quality gates for all commits and pushes

### Changed

- Updated all strsim-rs references to rapidfuzz-rs for consistency
- Package description now mentions rapidfuzz-rs instead of strsim-rs
- Documentation and fixture headers updated with rapidfuzz 0.5.x references

### Fixed

- Excluded similarity-validator binary from npm package (reduced from 841KB to 31.5KB)

### Developer Dependencies

- Added `husky@^9.1.7` for git hooks
- Added `license-checker@^25.0.1` for license compliance

[0.3.1]: https://github.com/3leaps/string-metrics-wasm/compare/v0.3.0...v0.3.1

## [0.3.0] - 2025-10-30

### Added

- **Token-based fuzzy matching** (TypeScript implementations)
  - `partialRatio(a, b)` - Substring matching with sliding window (0-100 scale)
  - `tokenSortRatio(a, b)` - Order-insensitive token comparison (0-100 scale)
  - `tokenSetRatio(a, b)` - Set-based token comparison handling duplicates (0-100 scale)
- **Process helpers** (TypeScript implementations)
  - `extractOne(query, choices, options)` - Find best match from array
  - `extract(query, choices, options)` - Find top N matches with configurable scorer, processor,
    cutoff, and limit
  - RapidFuzz-compatible API with `>=` cutoff semantics
- **Unified API** (TypeScript implementations)
  - `distance(a, b, metric?)` - Metric-selectable edit distance (default: levenshtein)
  - `score(a, b, metric?)` - Metric-selectable similarity score 0-1 normalized (default:
    jaro_winkler)
  - Supports all 16 metrics with consistent scaling
- **Extended WASM metrics** (rapidfuzz-rs 0.5.0 bindings)
  - `ratio(a, b)` - Basic fuzzy comparison using Indel distance (0-100 scale)
  - `indel_distance(a, b)` - Insertion/deletion only distance
  - `indel_normalized_similarity(a, b)` - Normalized indel similarity (0-1 scale)
  - `lcs_seq_distance(a, b)` - Longest Common Subsequence distance
  - `lcs_seq_similarity(a, b)` - LCS similarity (character count)
  - `lcs_seq_normalized_similarity(a, b)` - Normalized LCS (0-1 scale)
- **Extended Suggestions API**
  - Added support for 6 new metrics: ratio, partial_ratio, token_sort_ratio, token_set_ratio, indel,
    lcs_seq
  - Maintains backward compatibility with all existing metrics
- **Comprehensive test coverage**
  - 115 unit tests (up from 47, +68 new tests)
  - 80 YAML fixture test cases across 5 new fixture files
  - 100% coverage of all Phase 1b/1c functions

### Fixed

- **ratio() scale bug** - Now correctly returns 0-100 scale (was returning 0-1)
- **extractOne() cutoff comparison** - Changed from `>` to `>=` for RapidFuzz parity
- **tokenSetRatio() empty intersection** - Fixed bug returning 100 for completely different token
  sets

### Performance

- All operations complete in < 1ms per call
- WASM metrics: 0.0003-0.0005ms per operation
- Token-based metrics: 0.0003-0.0017ms per operation
- Process helpers: 0.0008-0.001ms per operation
- Unified API: minimal dispatch overhead

### Technical Details

- **Bundle size**: 226 KB (+1 KB from v0.2.0, well below 275 KB target)
- **Hybrid approach**: WASM primitives + TypeScript value-adds pattern
- **Testing**: Comprehensive YAML fixtures in `tests/fixtures/v2.0.0/rapidfuzz/`
- **Benchmarks**: Added `benchmark-phase1b.js` for performance verification

### Documentation

- **Comprehensive README** with full API documentation and usage examples
- **Implementation details** documenting WASM vs TypeScript implementations
- **Performance metrics** for all new functions
- **Links to rapidfuzz-rs** and related projects

[0.3.0]: https://github.com/3leaps/string-metrics-wasm/releases/tag/v0.3.0

## [0.2.0] - 2025-10-29

### Changed

- **Migrated from strsim-rs to rapidfuzz-rs 0.5.0**
  - All 8 core WASM functions now use rapidfuzz-rs
  - 100% API compatibility maintained (no breaking changes)
  - 47/47 TypeScript tests + 46/46 validator tests passing

### Performance

- **1.9x-2.6x faster** than strsim-rs across all metrics
  - levenshtein: +112% faster (3.27M ops/sec)
  - normalized_levenshtein: +159% faster (4.17M ops/sec)
  - jaro_winkler: +93% faster (3.72M ops/sec)
- **Bundle size**: 225 KB (within tolerance)

[0.2.0]: https://github.com/3leaps/string-metrics-wasm/releases/tag/v0.2.0

## [0.1.0] - 2025-10-29

### Added

- **WASM-based string similarity metrics** using strsim-rs binding
  - Levenshtein distance and normalized similarity
  - Damerau-Levenshtein (OSA and unrestricted variants)
  - Jaro and Jaro-Winkler similarity
  - Custom Jaro-Winkler with configurable prefix scaling
- **Substring similarity** (TypeScript implementation)
  - Longest Common Substring algorithm
  - Returns score and matched ranges in both query and candidate
- **Normalization presets** (WASM binding)
  - None, minimal, default, aggressive
  - Special handling for Turkish İ and German ß
  - Combining mark filtering for aggressive preset
- **Suggestions API** (TypeScript implementation)
  - Multi-metric "did you mean?" functionality
  - Supports all 5 metrics (levenshtein, damerau_osa, damerau_unrestricted, jaro_winkler, substring)
  - Normalization preset integration
  - Score filtering with configurable threshold
  - Optional prefix bonus (10% boost)
  - Preserves candidate order for tied scores
- **Similarity validator CLI tool**
  - Validates test fixtures against rapidfuzz-rs canonical implementation
  - Generates authoritative fixture values
  - Supports all metric categories
  - Cross-platform builds (macOS, Linux, Windows)
- **Comprehensive test fixtures** (v2.0.0 schema)
  - 46 test cases across 6 fixture files
  - Covers all metrics, normalization, and suggestions
  - Generated with validator for consistency
- **Documentation**
  - User guide for Suggestions API
  - Development guide
  - Bootstrap plan and enhancement plans

### Technical Details

- Built with Rust (strsim 0.11.x for WASM, rapidfuzz-rs 0.5 for validator)
- TypeScript/WASM hybrid approach
- Bun for testing and build tooling
- 100% test coverage (47 tests passing)

[0.1.0]: https://github.com/3leaps/string-metrics-wasm/releases/tag/v0.1.0
