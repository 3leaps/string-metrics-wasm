# Release Notes

This file contains release notes for the most recent release in reverse chronological order. For the
complete release history, see the [CHANGELOG](CHANGELOG.md) or the [docs/releases/](docs/releases/)
directory.

---

## v0.3.9 (2026-06-15)

**Standalone-Binary Packaging Fix, Smaller Package, and Toolchain Modernization**

v0.3.9 is a packaging and maintenance release. It fixes a startup crash when the library is bundled
into standalone compiled binaries, substantially shrinks the published npm package, and modernizes
the test toolchain and CI. There are **no public API changes** — all exports keep their existing
synchronous signatures and behavior, and metric results are unchanged.

### Standalone-Binary & Bundler Packaging Fix

The WASM binary is now embedded (base64) in the published JavaScript and initialized **lazily on
first use**, replacing the eager top-level `readFileSync` of a sibling `.wasm` asset. This fixes
startup crashes (`ENOENT`) when the library is bundled into standalone compiled binaries (e.g.
`bun build --compile`), where the asset path is rewritten but not embedded. Importing the package is
now side-effect-free, and there is no runtime filesystem read on any runtime.

### Smaller Published Package

The npm package shrank from ~545 kB to ~180 kB packed. The generated embedded-WASM constant is typed
as `string` (eliminating a ~300 kB inferred-literal `.d.ts`), and two now-redundant copies of the
binary are no longer published (the generated `src/wasm-inline.ts` source blob and the raw
`pkg/web/*.wasm`); the bytes ship embedded in `dist/wasm-inline.js`.

### Toolchain & CI Modernization

Upgraded the test stack to **Vitest 4** (with migrated coverage thresholds), bumped `@types/node` to
v24 and refreshed routine dev dependencies (Biome 2.5, Prettier, TypeScript, js-yaml; `wasm-pack`
held at 0.13.x), and modernized CI: the test matrix runs on **Node.js 22 and 24**, GitHub Actions
moved off the deprecated Node 20 runtime, and `wasm-pack` is installed directly via `cargo` rather
than a third-party action. Added unified-API metric tests to keep coverage above 90% under Vitest
4's stricter measurement.

See [docs/releases/v0.3.9.md](docs/releases/v0.3.9.md) for the complete release notes.

---

For v0.3.8 and earlier release notes, see the [docs/releases/](docs/releases/) directory or the
[CHANGELOG](CHANGELOG.md).
