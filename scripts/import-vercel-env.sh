#!/usr/bin/env bash
# Push vercel-import.env to Vercel (Production + Preview + Development).
# Usage: VERCEL_TOKEN=... ./scripts/import-vercel-env.sh [path-to-env-file]

set -euo pipefail

ENV_FILE="${1:-vercel-import.env}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

if ! command -v vercel &>/dev/null; then
  vercel() { npx vercel@54 "$@"; }
fi

echo "Linking Vercel project (things-to-do)..."
vercel link --yes 2>/dev/null || true

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^# ]] && continue
  [[ -z "$line" ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  if [[ -z "$value" || "$value" == PASTE_* ]]; then
    echo "Skip $key (empty or placeholder)"
    continue
  fi
  echo "Setting $key ..."
  printf '%s' "$value" | vercel env add "$key" production --force 2>/dev/null || true
  printf '%s' "$value" | vercel env add "$key" preview --force 2>/dev/null || true
  printf '%s' "$value" | vercel env add "$key" development --force 2>/dev/null || true
done < "$ENV_FILE"

echo "Done. Redeploy: vercel deploy --prod"
