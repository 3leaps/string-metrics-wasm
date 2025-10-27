# Test Fixtures

This directory hosts the specification-driven fixture catalog used across the Fulmen ecosystem.

- `fixtures/` – versioned YAML files matching `schemas/similarity.schema.json`
  - `v2.0.0/core/` holds the canonical seed set imported from Crucible (see `core.yaml`).
  - `v2.0.0/edge/` is reserved for focused edge cases (large strings, RTL text, token experiments,
    etc.).
- Feel free to add topical subfolders (e.g., `rapidfuzz/`, `benchmarks/`) as coverage expands.
- `index.test.ts` reads every `.yaml` file under `fixtures/**` so contributors can add new suites
  without editing the test harness.

## Adding Fixtures

1. Choose the schema version folder (e.g., `fixtures/v2.0.0/`). Create it if needed.
2. Drop a new YAML file that conforms to `schemas/similarity.schema.json`.
3. Keep descriptions/tags meaningful; downstream libraries re-use them for reporting.
4. Regenerate expected scores/distances via the canonical Rust/Python implementations before
   committing.

Tests run all fixture files automatically—no additional wiring required beyond the YAML. When
fixtures change, remember to sync updates with the shared Fulmen crucible repo so other language
bindings stay aligned.
