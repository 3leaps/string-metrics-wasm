# Release Notes

This file contains the **last 3 releases** in reverse chronological order. For older releases, see
the [release archive](docs/releases/).

---

## v0.2.0 (In Progress)

**Status:** Development (Phase 0 complete, Phase 1 pending) **Target Release Date:** TBD

### Highlights

- 🚀 **Migrated from strsim-rs to rapidfuzz-rs** for 1.9x–2.6x performance gains
- ⚡ **Massive performance improvements:** All core functions 93-159% faster
- 📦 **Bundle size:** +51 KB (+29%, within ≤50% tolerance)
- ✅ **100% API compatibility:** No breaking changes to function signatures
- 🔧 **Ecosystem alignment:** Matches pyfulmen/gofulmen/tsfulmen semantics

### Performance Highlights

| Function               | v0.1.0        | v0.2.0        | Improvement |
| ---------------------- | ------------- | ------------- | ----------- |
| levenshtein            | 1.54M ops/sec | 3.27M ops/sec | +112%       |
| normalized_levenshtein | 1.61M ops/sec | 4.17M ops/sec | +159%       |
| damerau_levenshtein    | 773K ops/sec  | 1.63M ops/sec | +111%       |
| jaro                   | 1.92M ops/sec | 3.72M ops/sec | +94%        |

### Migration

**No code changes required** for existing v0.1.0 users. If you need the exact strsim-rs behavior,
pin to `"string-metrics-wasm": "0.1.0"` in package.json.

### What's Next

Phase 1 will add token-based metrics (`ratio`, `partial_ratio`, `token_sort_ratio`, etc.) and
process helpers.

[📄 Full Release Notes →](docs/releases/v0.2.0.md)

---

## v0.1.0

**Release Date:** 2025-10-29 **Status:** Stable

### Highlights

- 🎉 **Initial release** of string-metrics-wasm
- 📊 8 core string similarity metrics via strsim-rs WASM bindings
- 🧩 High-level Suggestions API for "did you mean?" functionality
- 🔧 Similarity validator CLI with rapidfuzz-rs for fixture generation
- ✅ 47/47 TypeScript tests + 46/46 validator tests passing

### Core Features

- **Metrics:** Levenshtein, Damerau-Levenshtein (OSA & unrestricted), Jaro, Jaro-Winkler
- **Extended features:** Substring similarity, normalization presets
  (none/minimal/default/aggressive)
- **Suggestions API:** Multi-metric support, prefix bonuses, smart ranking, tie-break preservation

### Technical Details

- WASM Core: strsim-rs 0.11.x
- Validator: rapidfuzz-rs 0.5.0 (future-proofing for v0.2.0)
- Runtime: TypeScript with Bun
- Bundle size: 174 KB WASM + 11 KB JS glue

[📄 Full Release Notes →](docs/releases/v0.1.0.md)

---

## Archive Policy

This file maintains the **last 3 releases** chronologically. Older release notes are archived in the
[docs/releases/](docs/releases/) directory and remain accessible via git tags.

**Archive contents:**

- Detailed release notes for all versions
- Migration guides
- Breaking change documentation
- Performance benchmarks
- Known limitations

**Tags:**

- `v0.1.0` - Initial strsim-based release (2025-10-29)
- `v0.2.0` - RapidFuzz migration (TBD)

---

**For complete history:** `git tag -l` or browse [docs/releases/](docs/releases/)
