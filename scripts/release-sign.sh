#!/usr/bin/env bash
set -euo pipefail
#
# Sign the released npm tarball with the 3 Leaps minisign key and attach the
# checksums + signatures to the GitHub Release. Downloads the CI-attached tarball
# first so the checksums cover the exact released bytes.
#
# Run after the release CI job has created the GitHub Release.
#
# Environment:
#   STRING_METRICS_WASM_MINISIGN_KEY - minisign secret key (required)
#   STRING_METRICS_WASM_RELEASE_TAG  - override tag (default: v<package.json version>)

REPO="3leaps/string-metrics-wasm"

cd "$(git rev-parse --show-toplevel)"
version="$(node -p "require('./package.json').version")"
tag="${STRING_METRICS_WASM_RELEASE_TAG:-v${version}}"

key="${STRING_METRICS_WASM_MINISIGN_KEY:-}"
[ -n "$key" ] || { echo "❌ STRING_METRICS_WASM_MINISIGN_KEY is unset" >&2; exit 1; }
command -v minisign >/dev/null || { echo "❌ minisign not installed" >&2; exit 1; }
command -v gh >/dev/null || { echo "❌ gh not installed" >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cd "$work"

echo "→ downloading released tarball for ${tag}"
gh release download "$tag" --repo "$REPO" -p '3leaps-string-metrics-wasm-*.tgz'

echo "→ generating checksums"
shasum -a 256 3leaps-string-metrics-wasm-*.tgz > SHA256SUMS
shasum -a 512 3leaps-string-metrics-wasm-*.tgz > SHA512SUMS

echo "→ signing checksums with minisign"
minisign -S -s "$key" -m SHA256SUMS
minisign -S -s "$key" -m SHA512SUMS

echo "→ uploading sums + signatures to release ${tag}"
gh release upload "$tag" --repo "$REPO" --clobber \
  SHA256SUMS SHA256SUMS.minisig SHA512SUMS SHA512SUMS.minisig

echo "✅ signed artifacts uploaded to release ${tag}"
echo "   verify: minisign -Vm SHA256SUMS -p \"\$STRING_METRICS_WASM_MINISIGN_PUB\""
