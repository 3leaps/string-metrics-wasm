# Publishing Guide

Instructions for maintainers releasing `@3leaps/string-metrics-wasm` to npm.

## Prerequisites

- npm account with publish access to the `@3leaps` organization
- Member of @3leaps organization on npm with publish permissions
- Clean working tree (commit or stash local changes)
- Toolchain installed via `make bootstrap` (ensures `wasm-pack` 0.13.1 and npm deps)

## Release Checklist

1. **Ensure clean working tree**: `git status` should show no uncommitted changes
2. Confirm `Cargo.toml` and `package.json` share the target version (`make version-check`).
3. Bump the version with the Makefile helper:
   - Patch: `make bump-patch`
   - Minor: `make bump-minor`
   - Major: `make bump-major`
   - Or explicit: `make set-version VERSION=x.y.z`
4. Update CHANGELOG / release notes (if applicable).
5. **Run pre-commit checks** (`make precommit`):
   - Runs format, lint, typecheck, build, test, and fixture validation
   - Fix any errors and re-run until clean
6. **Stage and commit all changes**:
   ```bash
   git add -A
   git commit -m "chore: release vX.Y.Z"
   ```
   **⚠️ CRITICAL**: Pre-commit hook will run all checks including tests. After commit completes,
   verify repo is clean:
   ```bash
   git status  # Must show "nothing to commit, working tree clean"
   ```
   If the hook modified files (uncommitted changes shown), stage and amend:
   ```bash
   git add -A
   git commit --amend --no-edit
   git status  # Verify clean again
   ```
7. **Run full pre-push validation** (`make prepush`):
   - Ensures version sync, license compliance, and runs precommit (includes all checks)
   - Verifies working tree remains clean after all checks
8. **CRITICAL: Verify package contents and publish readiness BEFORE tagging**:

   ```bash
   # Verify WASM files are included
   npm pack --dry-run | grep pkg/web

   # Verify prepublishOnly hook passes (runs make quality && make build)
   npm publish --dry-run
   ```

9. **Tag the release locally** (don't push yet):
   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z - brief description"
   ```
10. **Push commit and tag to remote**:
    ```bash
    git push origin main
    git push origin vX.Y.Z
    ```
11. **Wait for CI/CD to pass**: Check GitHub Actions - all checks must be green before publishing
12. **Publish with public access** (required for scoped packages):
    ```bash
    npm publish --access public
    ```
    **⚠️ IMPORTANT**: The `--access public` flag is **required** for scoped packages (@3leaps/...).
    Without it, npm defaults to private access, which requires a paid organization plan.
13. **Post-publish verification** - Smoke-test the published version:
    ```bash
    npm install @3leaps/string-metrics-wasm@X.Y.Z
    ```
14. Create GitHub release from tag with release notes.

## What `npm publish` Does

`package.json` defines a `prepublishOnly` script that runs automatically right before the publish
step:

```bash
make quality && make build
```

This ensures:

- format/lint checks pass (Biome + Prettier)
  - **Lint warnings treated as errors** (`--error-on-warnings` flag in Makefile)
- TypeScript type checking passes (`tsc --noEmit`)
- Rust formatting/lints succeed (`cargo fmt --check`, `cargo clippy -- -D warnings`)
- WASM and TypeScript bundles are regenerated (`pkg/web/*`, `dist/*`)

If any command fails, the publish is aborted. This gate prevents broken releases like v0.3.5
(missing WASM files) from reaching npm.

## Published Artifacts

The npm tarball includes:

- `dist/` – compiled ESM bundle and type declarations
- **`pkg/web/`** – wasm-pack output with WASM binary (231 kB)
- `src/` – Rust and TypeScript sources for transparency
- `docs/` – developer and maintainer documentation
- `Cargo.toml`, `LICENSE`, `README.md`

**Excluded** (via `package.json` "files" field):

- `dist/similarity-validator*` – dev tool binary (saves ~800KB)
- `tests/`, `node_modules/`, `.plans/` – gitignored or dev-only
- Build tooling and configuration files

Typical published package size: ~270 kB compressed (WASM included), ~400 kB unpacked.

### WASM Packaging Pattern (CRITICAL)

**Why we MUST use `.npmignore`:**

This project uses `.npmignore` to solve a double-gitignore problem:

1. **Root `.gitignore`** has `pkg/` to keep build artifacts out of git
2. **wasm-pack creates** `pkg/web/.gitignore` with `*` (ignore everything)
3. **npm respects BOTH gitignores** even when `"pkg/web"` is in `package.json` files array
4. **Result**: WASM files were excluded from the npm package

**Our solution: Dual approach**

1. **`.npmignore`**: Explicitly allows `pkg/web` to override root `.gitignore` for npm packaging
2. **Build-time cleanup**: `prepare-wasm-package.js` script deletes nested `.gitignore`

```json
// package.json
"build:wasm": "wasm-pack build --target web --out-dir pkg/web && node scripts/prepare-wasm-package.js"
```

The `prepare-wasm-package.js` script runs after wasm-pack and:

- Deletes `pkg/web/.gitignore` (the blocker)
- Cleans stale `dist/wasm/` artifacts
- Allows `pkg/web/` contents to be packaged by npm

**Why this works:**

- Surgical fix: Only removes the problematic ignore file
- Build-time: Happens during `npm run build`, not at commit time
- Safe: `pkg/web/` remains in `.gitignore` for source control (build artifacts)
- Idempotent: Uses `force: true` so script won't fail if files missing

**Verification is CRITICAL:**

Always run before publishing:

```bash
npm pack --dry-run
```

Look for these files in "Tarball Contents":

```
pkg/web/string_metrics_wasm_bg.wasm    (231 kB)  ← MUST BE PRESENT
pkg/web/string_metrics_wasm.js         (14 kB)
pkg/web/string_metrics_wasm.d.ts       (4.5 kB)
```

If `pkg/web/` is missing, the package is broken and imports will fail.

## Post-Publish

After publish succeeds:

1. **Verify the package** on npm registry:

   ```bash
   npm view @3leaps/string-metrics-wasm
   ```

   Should show the new version within 1-2 minutes.

2. **Test installation**:

   ```bash
   npm install @3leaps/string-metrics-wasm@latest
   ```

3. **Verify GitHub release**:
   - Tag should be visible at https://github.com/3leaps/string-metrics-wasm/tags
   - Create GitHub release from tag with release notes

4. **Update dependent projects** (if needed):
   - tsfulmen, pyfulmen, or other 3leaps projects

5. **Announce the release** (internal Slack, release notes, etc.).

## Troubleshooting

### "You do not have permission to publish"

- Ensure you're a member of @3leaps organization on npm
- Check organization settings allow you to publish
- Verify you're logged in: `npm whoami`

### "Package not found" after publish

- Wait 1-2 minutes for npm registry propagation
- Check npm publish output for actual success message
- Verify with: `npm view @3leaps/string-metrics-wasm@X.Y.Z`

### "402 Payment Required"

- You forgot `--access public` flag
- Scoped packages default to private (requires paid plan)
- Unpublish and republish with `--access public`

For RapidFuzz migration planning and future roadmap discussions, see `.plans/`.
