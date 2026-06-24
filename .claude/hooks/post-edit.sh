#!/usr/bin/env bash
set -uo pipefail

[ -f package.json ] || exit 0

bun run format >/dev/null 2>&1 || true

if ! lint_output=$(bun run lint 2>&1); then
  echo "Biome lint found issues:" >&2
  echo "$lint_output" >&2
  exit 2
fi

exit 0