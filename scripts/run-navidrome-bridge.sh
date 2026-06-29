#!/usr/bin/env bash
# Run on the machine that hosts Navidrome SQLite (Linux / WSL / macOS).
# One-time: npm install better-sqlite3
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/scripts/navidrome-bridge.local.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${NAVIDROME_DB_PATH:-}" ]]; then
  echo "NAVIDROME_DB_PATH required. Copy scripts/navidrome-bridge.local.env.example" >&2
  exit 1
fi

npx tsx scripts/navidrome-bridge.ts
