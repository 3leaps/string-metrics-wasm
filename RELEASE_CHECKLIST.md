# Release Checklist (string-metrics-wasm)

`@3leaps/string-metrics-wasm` is a hybrid Rust/WASM + TypeScript **npm library**. A release is an
npm package published to npmjs.com plus a **GPG-signed git tag** for version tracking.

This checklist adapts the fulmenhq/tsfulmen library release pattern to string-metrics-wasm's
lighter, **manual-publish** flow, and uses **3 Leaps key materials** for tag signing. For expanded
per-step detail see [docs/publishing.md](docs/publishing.md).

## Release Model

Unlike the fully-automated fulmen libraries (OIDC trusted publishing), string-metrics-wasm currently
publishes **manually**:

1. **You do**: pre-release prep, dry-run verification, create + verify a **signed** tag, push.
2. **Automated**: the tag push triggers `ci.yml`'s release job, which creates the **GitHub
   Release**.
3. **You do**: `npm publish --access public`, then post-publish verification.

> Full OIDC automation and CI-side artifact signing are intentionally **out of scope** here (a
> v0.4.x hardening item). This checklist's firm requirement is a **GPG-signed git tag** using the 3
> Leaps key.

## Prerequisites (first-time setup)

- [ ] `gpg` and `minisign` installed (`brew install gnupg minisign`)
- [ ] **3 Leaps signing key materials** sourced: `source (maintainer-configured environment)`
      (exports `STRING_METRICS_WASM_GPG_HOMEDIR` → `$STRING_METRICS_WASM_GPG_HOMEDIR`, `STRING_METRICS_WASM_PGP_KEY_ID` → the 3 Leaps
      Infosec GPG key, and the 3 Leaps minisign keypair `STRING_METRICS_WASM_MINISIGN_KEY` /
      `STRING_METRICS_WASM_MINISIGN_PUB`)
- [ ] `gh` CLI authenticated
- [ ] `npm` logged in with publish access to the `@3leaps` scope (`npm whoami`)

## 1. Pre-Release (do not skip)

- [ ] `git status` is clean (all release content merged to `main`)
- [ ] Set the new version — `make set-version VERSION=X.Y.Z` (keeps `package.json` + `Cargo.toml` in
      sync; never edit version by hand)
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

## 3. Tagging (SIGNED — required)

### Step 1 — Prepare GPG

```bash
export GPG_TTY="$(tty)"
gpg-connect-agent updatestartuptty /bye
```

### Step 2 — Point git at the 3 Leaps signing key

```bash
source (maintainer-configured environment)
export GNUPGHOME="$STRING_METRICS_WASM_GPG_HOMEDIR"
git config user.signingkey "$STRING_METRICS_WASM_PGP_KEY_ID"   # 3 Leaps Infosec GPG key
```

### Step 3 — Create the signed tag (local only — do not push yet)

```bash
git tag -s "vX.Y.Z" -m "Release vX.Y.Z - <one-line summary>"
```

### Step 4 — Verify the signature locally (MUST pass)

```bash
git verify-tag "vX.Y.Z"
```

Expect a **Good signature** from the 3 Leaps Infosec Team key. If it fails, do not push — fix the
key setup (see Troubleshooting) and re-tag.

### Step 5 — Push main and the tag

```bash
git push origin main
git push origin "vX.Y.Z"
```

> **Point of no return for the GitHub release**: the tag push triggers `ci.yml`'s release job, which
> creates the GitHub Release. (npm is still a separate manual step below.)

## 4. Publish + Sign Artifacts (manual)

- [ ] Wait for the tag's CI run (Validate + matrix + **Create Release**) to be green — CI has now
      created the GitHub Release with the package tarball attached and the per-version notes as the
      body
- [ ] Publish to npm — `npm publish --access public`
- [ ] Sign the released artifact with the 3 Leaps minisign key and attach the checksums + signatures
      to the GitHub Release. Download the **CI-attached** tarball first so the checksums cover the
      exact released bytes:

```bash
source (maintainer-configured environment)
TARBALL="3leaps-string-metrics-wasm-X.Y.Z.tgz"

gh release download "vX.Y.Z" -p "$TARBALL"             # the exact CI-attached tarball
shasum -a 256 "$TARBALL" > SHA256SUMS
shasum -a 512 "$TARBALL" > SHA512SUMS
minisign -S -s "$STRING_METRICS_WASM_MINISIGN_KEY" -m SHA256SUMS    # → SHA256SUMS.minisig
minisign -S -s "$STRING_METRICS_WASM_MINISIGN_KEY" -m SHA512SUMS    # → SHA512SUMS.minisig
gh release upload "vX.Y.Z" SHA256SUMS SHA256SUMS.minisig SHA512SUMS SHA512SUMS.minisig
```

> Verifiers use the 3 Leaps minisign public key (`$STRING_METRICS_WASM_MINISIGN_PUB`), e.g.
> `minisign -Vm SHA256SUMS -p <release-signing.pub>`. Moving SHA-sum + minisig generation
> into the release workflow (CI-side) is a v0.4.x item.

## 5. Post-Release Verification

- [ ] `node scripts/verify-published-package.cjs X.Y.Z` — expect `✅ Package verification PASSED`
      (validates the embedded contract + runtime functions against the live package)
- [ ] `npm view @3leaps/string-metrics-wasm version` — confirm it shows X.Y.Z
- [ ] `git verify-tag vX.Y.Z` — re-confirm the signature (optionally on a fresh checkout)
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
gh release delete "vX.Y.Z" --yes --cleanup-tag   # deletes the GitHub Release AND the remote tag
git tag -d "vX.Y.Z"                               # delete the local tag
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
- Pattern: fulmenhq/tsfulmen `RELEASE_CHECKLIST.md` (library release shape); 3 Leaps key materials
  via `(maintainer-configured environment)`
