# Documentation Overview

Welcome to the `string-metrics-wasm` documentation hub. This project blends high-performance
Rust/WASM bindings from [rapidfuzz-rs](https://github.com/rapidfuzz/rapidfuzz-rs) with TypeScript
convenience APIs to deliver an ergonomic, cross-runtime string similarity toolkit. Use this page as
a guide to the rest of the documentation.

## Core Concepts

- **WASM bindings** (`src/lib.rs`, `pkg/web/`) expose RapidFuzz distance/similarity primitives such
  as Levenshtein, Damerau-Levenshtein, Jaro/Jaro-Winkler, Indel, and LCS, compiled to a portable
  WebAssembly module.
- **TypeScript facade** (`src/index.ts`) layers additional helpers on top of the WASM exports:
  substring similarity, token ratios, RapidFuzz-style `process` helpers (`extract`/`extractOne`),
  normalization presets, and unified `distance` / `score` dispatchers. The API is camelCase-first
  but accepts snake_case aliases for compatibility with Fulmen/Crucible configs.
- **Similarity validator** (`similarity-validator/`) is a companion Rust CLI built on rapidfuzz-rs.
  It validates YAML fixtures, generates expected values, and keeps the TypeScript tests aligned with
  the canonical RapidFuzz implementation.

## Where to Go Next

- **Getting Started:** The main [README](../README.md) covers installation, quick start examples,
  and a detailed API reference.
- **Development Workflow:** See [docs/development.md](development.md) for local setup, project
  layout, build/test commands, and fixture management tips.
- **Publishing & Release Process:** Maintainers should follow [docs/publishing.md](publishing.md)
  for release checklists, `npm publish` workflow, and GitHub release guidance.
- **User Guides:** The [user-guide](user-guide/) directory currently contains a deep dive into the
  Suggestions API and will expand over time with more feature-specific guides.
- **Release Notes & Benchmarks:** The [releases](releases/) folder archives version-specific notes,
  while [benchmarks](benchmarks/) compare WASM performance across library iterations.
- **Validator Details:** Read [similarity-validator/README.md](../similarity-validator/README.md)
  for information on building and using the RapidFuzz-backed fixture validator.

## Intended Audience

- **Library Consumers** who want to add high-quality fuzzy matching to TypeScript/JavaScript
  applications across Node, Bun, and Deno.
- **Fulmen Ecosystem Contributors** needing compatibility with Crucible schemas and rapidfuzz-style
  scoring semantics.
- **Maintainers & Contributors** working on the Rust bindings, TypeScript extensions, or validator.

If you spot gaps or have ideas for additional guides, please open an issue or pull request—this
overview is meant to grow alongside the project.
