# Publishing Guide

Instructions for maintainers releasing `string-metrics-wasm` to npm.

## Prerequisites

- npm account with publish access to the `string-metrics-wasm` package.
- Clean working tree (commit or stash local changes).
- Toolchain installed via `make bootstrap` (ensures `wasm-pack` 0.13.1 and npm deps).

## Release Checklist

1. Confirm `Cargo.toml` and `package.json` share the target version (`make version-check`).
2. Bump the version with the Makefile helper:
   - Patch: `make bump-patch`
   - Minor: `make bump-minor`
   - Major: `make bump-major`
   - Or explicit: `make set-version VERSION=x.y.z`
3. Update CHANGELOG / release notes (if applicable).
4. Run the test suite: `make test`.
5. Verify the package payload (optional):
   ```bash
   npm pack --dry-run
   ```
6. Publish: `npm publish`.
7. Tag the release (`git tag vX.Y.Z && git push --tags`) and create a GitHub release.
8. Smoke-test the published version (e.g., `npm install string-metrics-wasm@X.Y.Z` in a sample app).

## What `npm publish` Does

`package.json` defines a `prepublishOnly` script that runs automatically right before the publish
step:

```bash
make quality && make build
```

This ensures:

- format/lint checks pass (Biome + Prettier)
- Rust formatting/lints succeed (`cargo fmt --check`, `cargo clippy`)
- WASM and TypeScript bundles are regenerated (`pkg/web/*`, `dist/*`)

If any command fails, the publish is aborted.

## Published Artifacts

The npm tarball (see `.npmignore`) contains:

- `dist/` – compiled ESM bundle and type declarations
- `pkg/` – wasm-pack output (`web` target)
- `src/` – Rust and TypeScript sources for transparency
- `docs/` – developer and maintainer documentation
- `Cargo.toml`, `LICENSE`, `README.md`

Excluded items include tests, planning docs, build tooling, and node_modules. Tests remain available
in the GitHub repository.

## Post-Publish

After publish succeeds:

1. Monitor npm for the new version appearing (usually within a minute).
2. Announce the release (internal Slack, release notes, etc.).
3. Coordinate with CI to ensure the new tag gets coverage on Linux/macOS (Windows support arrives in
   v0.1.1+).

For RapidFuzz migration planning and future roadmap discussions, see `.plans/`.
