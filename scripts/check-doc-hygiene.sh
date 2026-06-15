#!/usr/bin/env bash
#
# Doc hygiene guard for the public documentation surface.
#
# Public docs ship in the repo and the npm package; they must not embed
# machine- or maintainer-specific setup. Release tooling is referenced by
# ENVIRONMENT-VARIABLE NAME only; how those variables get configured is handled
# out-of-band and is intentionally never documented in the repo.
#
# This guard detects leak *classes* structurally (it deliberately does not
# hardcode any internal names, so the guard itself stays clean):
#   1. Absolute / home filesystem paths.
#   2. Sourcing a local file (leaks local environment setup).

set -euo pipefail

mapfile -t DOCS < <(
  printf '%s\n' README.md AGENTS.md RELEASE_CHECKLIST.md CHANGELOG.md RELEASE_NOTES.md
  find docs -type f -name '*.md' 2>/dev/null
)

fail=0

# (1) absolute / home filesystem paths in prose/commands
if grep -nE '/Users/|/home/[a-z]|(^|[^[:alnum:]_/])~/[A-Za-z._-]' "${DOCS[@]}" 2>/dev/null; then
  echo "❌ doc hygiene (1): absolute/home filesystem path in public docs — reference env-var names only"
  fail=1
fi

# (2) sourcing a local file (leaks local environment setup conventions)
if grep -nE '(^|[[:space:]])source[[:space:]]+[~./]' "${DOCS[@]}" 2>/dev/null; then
  echo "❌ doc hygiene (2): sourcing a local file in public docs — keep environment setup out-of-band"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "✅ doc hygiene: public docs carry no machine-specific paths or local setup"
fi
exit "$fail"
