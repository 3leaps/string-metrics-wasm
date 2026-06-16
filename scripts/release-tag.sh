#!/usr/bin/env bash
set -euo pipefail
#
# Create and verify a GPG-signed release tag for the current package.json version.
#
# Environment (configured out-of-band by maintainers; names only):
#   STRING_METRICS_WASM_GPG_HOMEDIR    - dedicated GnuPG home holding the signing key
#   STRING_METRICS_WASM_PGP_KEY_ID     - GPG signing key id (requires GPG_HOMEDIR)
#   STRING_METRICS_WASM_RELEASE_TAG    - override tag (default: v<package.json version>)
#   STRING_METRICS_WASM_ALLOW_NON_MAIN - set to 1 to allow tagging off main

cd "$(git rev-parse --show-toplevel)"

version="$(node -p "require('./package.json').version")"
tag="${STRING_METRICS_WASM_RELEASE_TAG:-v${version}}"

if [ "$tag" != "v${version}" ]; then
  echo "❌ tag/version mismatch: ${tag} vs v${version}" >&2
  exit 1
fi
if ! [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ invalid release tag '${tag}' (expected vMAJOR.MINOR.PATCH)" >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ working tree is not clean (commit or stash before tagging)" >&2
  git status --porcelain >&2
  exit 1
fi

branch="$(git branch --show-current 2>/dev/null || true)"
if [ "$branch" != "main" ] && [ "${STRING_METRICS_WASM_ALLOW_NON_MAIN:-}" != "1" ]; then
  echo "❌ refusing to tag from branch '${branch}' (set STRING_METRICS_WASM_ALLOW_NON_MAIN=1 to override)" >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
  echo "❌ tag ${tag} already exists" >&2
  exit 1
fi

homedir="${STRING_METRICS_WASM_GPG_HOMEDIR:-}"
keyid="${STRING_METRICS_WASM_PGP_KEY_ID:-}"
if [ -n "$homedir" ]; then
  [ -d "$homedir" ] || { echo "❌ STRING_METRICS_WASM_GPG_HOMEDIR is not a directory" >&2; exit 1; }
  export GNUPGHOME="$homedir"
fi
if [ -n "$keyid" ] && [ -z "$homedir" ]; then
  echo "❌ STRING_METRICS_WASM_PGP_KEY_ID is set but STRING_METRICS_WASM_GPG_HOMEDIR is not" >&2
  exit 1
fi

if [ -t 0 ] && [ -t 1 ]; then
  tty_path="$(tty 2>/dev/null || true)"
  if [ -n "$tty_path" ] && [ "$tty_path" != "not a tty" ]; then
    export GPG_TTY="$tty_path"
    gpg-connect-agent updatestartuptty /bye >/dev/null 2>&1 || true
  fi
else
  echo "❌ no TTY for interactive GPG signing — run in an interactive terminal" >&2
  exit 1
fi

echo "→ creating signed tag: ${tag}"
if [ -n "$keyid" ]; then
  git tag -s -a "$tag" -u "$keyid" -m "Release ${tag}"
else
  git tag -s -a "$tag" -m "Release ${tag}"
fi

echo "→ verifying signature: ${tag}"
git verify-tag "$tag" >/dev/null

echo "✅ signed tag created and verified: ${tag}"
echo "   next: git push origin main && git push origin ${tag}"
