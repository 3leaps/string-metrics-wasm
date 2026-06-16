#!/usr/bin/env bash
set -euo pipefail
#
# Guard: the release tag matches the package.json version. CI-friendly.
#
# Tag source: $STRING_METRICS_WASM_RELEASE_TAG if set, else the exact tag on HEAD.
# Set STRING_METRICS_WASM_REQUIRE_TAG=1 to fail when no tag is present (release CI).

cd "$(git rev-parse --show-toplevel)"

version="$(node -p "require('./package.json').version")"
expected="v${version}"

tag="${STRING_METRICS_WASM_RELEASE_TAG:-$(git describe --tags --exact-match 2>/dev/null || true)}"

if [ -z "$tag" ]; then
  if [ "${STRING_METRICS_WASM_REQUIRE_TAG:-}" = "1" ]; then
    echo "❌ no exact tag on HEAD and STRING_METRICS_WASM_RELEASE_TAG is unset" >&2
    exit 1
  fi
  echo "ℹ no release tag on HEAD; package.json version is ${version} (expected tag ${expected})"
  exit 0
fi

if [ "$tag" != "$expected" ]; then
  echo "❌ tag/version mismatch: tag=${tag}, package.json=${version} (expected ${expected})" >&2
  exit 1
fi

echo "✅ tag matches package.json version: ${expected}"
