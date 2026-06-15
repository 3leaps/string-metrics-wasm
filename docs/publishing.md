# Publishing Guide

Instructions for maintainers releasing `@3leaps/string-metrics-wasm` to npm.

## Prerequisites

- npm account with publish access to the `@3leaps` organization
- Member of @3leaps organization on npm with publish permissions
- Clean working tree (commit or stash local changes)
- Toolchain installed via `make bootstrap` (ensures `wasm-pack` 0.13.1 and npm deps)
- `gpg` and `minisign` installed, and the release-signing environment variables exported (see
  [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) "Prerequisites" — variable names only;
  maintainer-configured out-of-band). Release tags **must be GPG-signed**.

## Release Checklist

> **Use [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md)** as the authoritative checkbox release
> checklist (prerequisites → signed tag → publish → verify). This guide is the expanded per-step
> reference for the same flow.

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
   # Confirm the slim embedded-WASM contract (see RELEASE_CHECKLIST.md and CI):
   #   dist/wasm-inline.js present, pkg/web/string_metrics_wasm.js (glue) present,
   #   pkg/web/string_metrics_wasm_bg.wasm ABSENT, src/wasm-inline.ts ABSENT (~180 kB packed)
   npm pack --dry-run

   # Verify prepublishOnly hook passes (runs make quality && make build)
   npm publish --dry-run --access public
   ```

9. **Create a signed tag locally** (don't push yet). Release tags must be **GPG-signed**. This
   assumes the release-signing environment variables are exported (see RELEASE_CHECKLIST.md):

   ```bash
   export GPG_TTY="$(tty)"
   gpg-connect-agent updatestartuptty /bye
   export GNUPGHOME="$STRING_METRICS_WASM_GPG_HOMEDIR"
   git config user.signingkey "$STRING_METRICS_WASM_PGP_KEY_ID"

   git tag -s "$STRING_METRICS_WASM_RELEASE_KEY" -m "Release $STRING_METRICS_WASM_RELEASE_KEY - brief description"
   git verify-tag "$STRING_METRICS_WASM_RELEASE_KEY"   # MUST show a good signature
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
13. **Sign the released artifact**. Download the CI-attached tarball, generate SHA256/512 checksums,
    sign them with the minisign key, and upload the sums + signatures to the release:
    ```bash
    gh release download "$STRING_METRICS_WASM_RELEASE_KEY" -p '3leaps-string-metrics-wasm-*.tgz'
    shasum -a 256 3leaps-string-metrics-wasm-*.tgz > SHA256SUMS
    shasum -a 512 3leaps-string-metrics-wasm-*.tgz > SHA512SUMS
    minisign -S -s "$STRING_METRICS_WASM_MINISIGN_KEY" -m SHA256SUMS
    minisign -S -s "$STRING_METRICS_WASM_MINISIGN_KEY" -m SHA512SUMS
    gh release upload "$STRING_METRICS_WASM_RELEASE_KEY" SHA256SUMS SHA256SUMS.minisig SHA512SUMS SHA512SUMS.minisig
    ```
    (CI-side artifact signing is a v0.4.x item; today the checksums + minisig are produced
    manually.)
14. **Post-publish verification** - Run automated verification script:

    ```bash
    # Verify specific version
    node scripts/verify-published-package.cjs X.Y.Z

    # Or verify latest
    node scripts/verify-published-package.cjs
    ```

    This script:
    - Installs the package in a clean temp directory
    - Verifies the embedded-WASM contract: `dist/wasm-inline.js` + JS glue present, raw `.wasm`
      absent
    - Tests core functions (levenshtein, jaro_winkler, normalize)
    - Tests locale-aware normalization (v0.3.8+)
    - Tests RapidFuzz compatibility (ratio)
    - Cleans up automatically

    **Expected output**: `✅ Package verification PASSED`

15. The GitHub Release is created automatically by CI when the signed tag is pushed (step 10–11).
    The release job guards that the tag matches `package.json`, that `docs/releases/vX.Y.Z.md`
    exists, and uses that file as the release body.

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
- WASM and TypeScript bundles are regenerated (`pkg/web/*`, embedded `src/wasm-inline.ts`, `dist/*`)

If any command fails, the publish is aborted. This gate prevents broken releases like v0.3.5
(missing WASM files) from reaching npm.

## Published Artifacts

Since v0.3.9 the WASM binary is **embedded** (base64) in the JS bundle and loaded synchronously via
`initSync`; the loader never reads a `.wasm` file at runtime. The npm tarball includes:

- `dist/` – compiled ESM bundle and type declarations, including **`dist/wasm-inline.js`** (the
  embedded base64 WASM, ~311 kB; compresses well, so packed size stays small)
- **`pkg/web/string_metrics_wasm.js`** – the wasm-bindgen JS glue (~15 kB), still required at
  runtime
- `src/` – Rust and TypeScript sources for transparency
- `docs/` – developer and maintainer documentation
- `Cargo.toml`, `LICENSE`, `README.md`

**Excluded** (via `package.json` "files" negations):

- **`pkg/web/string_metrics_wasm_bg.wasm`** – the raw WASM binary; redundant now that it ships
  embedded in `dist/wasm-inline.js` (saves ~233 kB)
- **`src/wasm-inline.ts`** – the generated base64 source blob; the compiled `dist/wasm-inline.js` is
  what ships (saves ~311 kB)
- `dist/similarity-validator*` – dev tool binary
- `tests/`, `node_modules/`, `.plans/` – gitignored or dev-only

Typical published package size: ~180 kB compressed, ~520 kB unpacked.

### WASM Packaging Pattern (CRITICAL)

The WASM bytes ship **embedded** in `dist/wasm-inline.js` (generated at build time by
`scripts/embed-wasm.js`). The wasm-bindgen JS glue (`pkg/web/string_metrics_wasm.js`) is still
published and imported by the loader; the **raw `.wasm` binary is intentionally not published**.

**Why we still need `.npmignore`** (for the glue): wasm-pack writes a `pkg/web/.gitignore` with `*`,
and the root `.gitignore` has `pkg/`, so npm would otherwise exclude all of `pkg/web/` even though
it is in the `files` array. The `.npmignore` un-ignores `pkg/web/**`, and `prepare-wasm-package.js`
deletes the nested `pkg/web/.gitignore` at build time.

```json
// package.json
"build:wasm": "wasm-pack build --target web --out-dir pkg/web && node scripts/embed-wasm.js && node scripts/prepare-wasm-package.js"
```

The redundant raw `.wasm` and the generated `src/wasm-inline.ts` are then excluded via `files`
negations in `package.json` (and mirrored in `.npmignore`):

```json
"files": ["dist", "...", "pkg/web", "!pkg/web/string_metrics_wasm_bg.wasm", "src", "!src/wasm-inline.ts", "..."]
```

**Verification is CRITICAL:**

Always run before publishing:

```bash
npm pack --dry-run
```

Confirm the package contract in "Tarball Contents":

```
dist/wasm-inline.js                    (~311 kB)  ← MUST BE PRESENT (embedded WASM)
pkg/web/string_metrics_wasm.js         (~15 kB)   ← MUST BE PRESENT (JS glue)
pkg/web/string_metrics_wasm_bg.wasm               ← MUST BE ABSENT (redundant; embedded instead)
src/wasm-inline.ts                                ← MUST BE ABSENT (redundant generated blob)
```

The CI "Check package contents" job and `scripts/verify-published-package.cjs` both assert this
contract. If `dist/wasm-inline.js` or the JS glue is missing, imports will fail; if the raw `.wasm`
reappears, the package is shipping dead weight.

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
