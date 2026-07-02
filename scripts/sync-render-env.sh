#!/usr/bin/env bash
# Pull production env from Vercel and push to a Render web service.
#
# Prerequisites:
#   export RENDER_API_KEY=rnd_...   # https://dashboard.render.com/u/*/settings#api-keys
#   export VERCEL_TOKEN=...         # or `vercel login`
#
# Usage:
#   ./scripts/sync-render-env.sh <render-service-id> [render-hostname]
#
# Example:
#   ./scripts/sync-render-env.sh srv-abc123 deputy.onrender.com
#
# If hostname is omitted, APP_URL / NEXT_PUBLIC_APP_URL are left as pulled from Vercel
# (update them manually to your onrender.com URL after first deploy).

set -euo pipefail

SERVICE_ID="${1:-}"
RENDER_HOST="${2:-}"

if [[ -z "$SERVICE_ID" ]]; then
  echo "Usage: $0 <render-service-id> [render-hostname]"
  echo "  List services: render services -o json  (requires RENDER_API_KEY)"
  exit 1
fi

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "Missing RENDER_API_KEY — add it to Cursor Cloud Agent secrets or export locally."
  exit 1
fi

if ! command -v vercel &>/dev/null; then
  vercel() { npx vercel@54 "$@"; }
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE=".env.render-sync"
echo "Pulling Vercel production env to $ENV_FILE ..."
vercel env pull "$ENV_FILE" --environment=production --yes 2>/dev/null || vercel env pull "$ENV_FILE" --environment=production

if [[ -n "$RENDER_HOST" ]]; then
  RENDER_URL="https://${RENDER_HOST#https://}"
  RENDER_URL="${RENDER_URL#http://}"
  RENDER_URL="https://${RENDER_URL}"
  echo "Patching APP_URL and NEXT_PUBLIC_APP_URL -> $RENDER_URL"
  if grep -q '^APP_URL=' "$ENV_FILE"; then
    sed -i "s|^APP_URL=.*|APP_URL=$RENDER_URL|" "$ENV_FILE"
  else
    echo "APP_URL=$RENDER_URL" >> "$ENV_FILE"
  fi
  if grep -q '^NEXT_PUBLIC_APP_URL=' "$ENV_FILE"; then
    sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=$RENDER_URL|" "$ENV_FILE"
  else
    echo "NEXT_PUBLIC_APP_URL=$RENDER_URL" >> "$ENV_FILE"
  fi
fi

# Build JSON payload for Render API (skip comments and empty values)
payload='{"envVars":['
first=true
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^# ]] && continue
  [[ -z "$line" ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  [[ -z "$key" || -z "$value" ]] && continue
  if $first; then first=false; else payload+=','; fi
  # Escape JSON string
  esc=$(printf '%s' "$value" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
  payload+="{\"key\":\"$key\",\"value\":$esc}"
done < "$ENV_FILE"
payload+=']}'

echo "Pushing env vars to Render service $SERVICE_ID ..."
http_code=$(curl -sS -o /tmp/render-env-response.json -w '%{http_code}' \
  -X PUT "https://api.render.com/v1/services/${SERVICE_ID}/env-vars" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$payload")

if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
  echo "Render API error (HTTP $http_code):"
  cat /tmp/render-env-response.json
  exit 1
fi

echo "Done. Trigger redeploy in Render Dashboard or:"
echo "  curl -X POST https://api.render.com/v1/services/${SERVICE_ID}/deploys -H \"Authorization: Bearer \$RENDER_API_KEY\""
rm -f "$ENV_FILE"
