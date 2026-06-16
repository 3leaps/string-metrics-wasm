# Release Checklist (string-metrics-wasm)

`@3leaps/string-metrics-wasm` is a hybrid Rust/WASM + TypeScript **npm library**. A release is an
npm package published to npmjs.com plus a **GPG-signed git tag** for version tracking.

This checklist adapts the fulmenhq/tsfulmen library release pattern to string-metrics-wasm's
lighter, **manual-publish** flow. For expanded per-step detail see
[docs/publishing.md](docs/publishing.md).

## Release Model

Unlike the fully-automated fulmen libraries (OIDC trusted publishing), string-metrics-wasm currently
publishes **manually**:

1. **You do**: pre-release prep, dry-run verification, create + verify a **signed** tag, push.
2. **Automated**: the tag push triggers `ci.yml`'s release job, which creates the **GitHub
   Release**.
3. **You do**: `npm publish --access public`, then post-publish verification.

> Full OIDC automation and CI-side artifact signing are intentionally **out of scope** here (a
> v0.4.x hardening item). This checklist's firm requirement is a **GPG-signed git tag**.

## Prerequisites (first-time setup)

- [ ] `gpg` and `minisign` installed (`brew install gnupg minisign`)
- [ ] The release-signing **environment variables** below are exported in your shell. How they are
      configured is a maintainer concern handled out-of-band — this checklist references variable
      **names only** and never their values or locations. The release tag is derived from
      `package.json` (`vX.Y.Z`), so no tag variable is needed (set `STRING_METRICS_WASM_RELEASE_TAG`
      only to override):
  - `STRING_METRICS_WASM_GPG_HOMEDIR` — GnuPG home containing the signing key
  - `STRING_METRICS_WASM_PGP_KEY_ID` — the GPG signing key id
  - `STRING_METRICS_WASM_MINISIGN_KEY` / `STRING_METRICS_WASM_MINISIGN_PUB` — minisign secret/public
    keys for artifact signing
- [ ] `gh` CLI authenticated
- [ ] `npm` logged in with publish access to the `@3leaps` scope (`npm whoami`)

## 1. Pre-Release (do not skip)

- [ ] `git status` is clean (all release content merged to `main`)
- [ ] Set the new version — `make set-version VERSION=X.Y.Z` (keeps `package.json` + `Cargo.toml` in
      sync; never edit version by hand). The workspace `Cargo.lock` bumps on the next `cargo`
      build/check, not by `set-version` — run `make build` (or `make precommit`) and **stage the
      updated `Cargo.lock`** with the prep commit so the tree stays clean (`make prepush` enforces
      this).
- [ ] `CHANGELOG.md`: move `[Unreleased]` → `## [X.Y.Z] - YYYY-MM-DD` and add the compare link
- [ ] `RELEASE_NOTES.md`: update the top entry to vX.Y.Z
- [ ] `docs/releases/vX.Y.Z.md`: create per-version notes
- [ ] Verify version consistency — `make version-check`
- [ ] Full gate (build + tests + fixtures + quality) — `make precommit`
- [ ] Commit the prep; confirm a clean tree (`make prepush` enforces this)

## 2. Dry-Run Verification (prevents burning the version)

> npm publishes are permanent — a version cannot be unpublished, only deprecated. Do not tag until
> these pass.

- [ ] `npm pack --dry-run` — confirm the **slim embedded-WASM contract**: `dist/wasm-inline.js`
      present, `pkg/web/string_metrics_wasm.js` (glue) present,
      `pkg/web/string_metrics_wasm_bg.wasm` **absent**, `src/wasm-inline.ts` **absent** (~180 kB
      packed)
- [ ] `npm publish --dry-run --access public` — runs `prepublishOnly` (`make quality && make build`)

## 3. Tag (SIGNED — required)

With the signing environment set (Prerequisites), the tag is derived from `package.json` (`vX.Y.Z`):

```bash
make release-guard-tag-version   # sanity: the version that will be tagged
make release-tag                 # creates + verifies a GPG-signed tag (prompts for the key passphrase)
```

`make release-tag` runs the guards (clean tree, on `main`, semver, tag-not-existing), signs the tag,
and verifies the signature. If verification fails, fix the key setup (see Troubleshooting) and
re-tag. Then push:

```bash
TAG="v$(node -p "require('./package.json').version")"
git push origin main
git push origin "$TAG"
```

> **Point of no return for the GitHub release**: the tag push triggers `ci.yml`'s release job, which
> creates the GitHub Release. (npm is still a separate manual step below.)

## 4. Publish + Sign Artifacts (manual)

- [ ] Wait for the tag's CI run (Validate + matrix + **Create Release**) to be green — CI has
      created the GitHub Release with the package tarball attached and the per-version notes as the
      body
- [ ] Publish to npm — `npm publish --access public`
- [ ] Sign the released artifact:

```bash
make release-sign   # downloads the released tarball, generates + minisigns SHA256/512SUMS, uploads them
```

> Verifiers use the minisign public key in `$STRING_METRICS_WASM_MINISIGN_PUB`
> (`minisign -Vm SHA256SUMS -p "$STRING_METRICS_WASM_MINISIGN_PUB"`). Moving artifact signing
> CI-side is a v0.4.x item.

## 5. Post-Release Verification

- [ ] `node scripts/verify-published-package.cjs X.Y.Z` — expect `✅ Package verification PASSED`
      (validates the embedded contract + runtime functions against the live package)
- [ ] `npm view @3leaps/string-metrics-wasm version` — confirm it shows X.Y.Z
- [ ] `make release-verify-tag` — re-confirm the tag signature
- [ ] Confirm the GitHub Release exists with the vX.Y.Z notes

## Troubleshooting

### GPG pinentry dialog not appearing

```bash
gpgconf --kill gpg-agent
export GPG_TTY="$(tty)"
gpg-connect-agent updatestartuptty /bye
```

### Tag pushed but a problem found before npm publish

The tag push already created a GitHub Release (with the package tarball). Remove the release **and**
the tag, then re-tag after fixing — otherwise a stale public release/asset is left behind:

```bash
TAG="v$(node -p "require('./package.json').version")"
gh release delete "$TAG" --yes --cleanup-tag   # release + remote tag
git tag -d "$TAG"                               # local tag
# fix on main, then re-run the signed-tag steps (section 3) and re-push
```

### Problem found after npm publish

npm packages cannot be unpublished — deprecate and ship a patch:

```bash
npm deprecate "@3leaps/string-metrics-wasm@X.Y.Z" "Use X.Y.(Z+1)"
# then run this checklist for X.Y.(Z+1)
```

## Cross-References

- [docs/publishing.md](docs/publishing.md) — expanded per-step publishing guide
- [RELEASE_NOTES.md](RELEASE_NOTES.md) — recent release summaries
- [CHANGELOG.md](CHANGELOG.md) — full version history
- Pattern: fulmenhq/tsfulmen `RELEASE_CHECKLIST.md` (library release shape). Signing key materials
  are maintainer-managed out-of-band and are **not** referenced by path here.
