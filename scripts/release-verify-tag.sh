#!/usr/bin/env bash
set -euo pipefail
#
# Verify the GPG signature on the release tag for the current package.json version.
#
# Environment:
#   STRING_METRICS_WASM_GPG_HOMEDIR  - GnuPG home holding the signing public key
#   STRING_METRICS_WASM_RELEASE_TAG  - override tag (default: v<package.json version>)

cd "$(git rev-parse --show-toplevel)"

version="$(node -p "require('./package.json').version")"
tag="${STRING_METRICS_WASM_RELEASE_TAG:-v${version}}"

homedir="${STRING_METRICS_WASM_GPG_HOMEDIR:-}"
if [ -n "$homedir" ]; then
  [ -d "$homedir" ] || { echo "❌ STRING_METRICS_WASM_GPG_HOMEDIR is not a directory" >&2; exit 1; }
  export GNUPGHOME="$homedir"
fi

echo "→ verifying tag signature: ${tag}"
git verify-tag "$tag"
echo "✅ tag verified: ${tag}"
