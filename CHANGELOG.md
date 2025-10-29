# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
