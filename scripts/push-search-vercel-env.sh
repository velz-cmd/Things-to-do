#!/usr/bin/env bash
# Push search provider env vars to Vercel. Never commit API keys.
#
# Usage:
#   export VERCEL_TOKEN=...
#   export TAVILY_API_KEY=tvly-...
#   export SERPER_API_KEY=...
#   export WEBSEARCH_API_KEY=wsa_...
#   ./scripts/push-search-vercel-env.sh

set -euo pipefail

VERCEL_ORG_ID="${VERCEL_ORG_ID:-team_JE6WKRJNgG5DlDCnTMQA23pB}"
VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-prj_0xIUtSzxZ2Cqeie8eHYB6iPAKIN0}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "Set VERCEL_TOKEN from https://vercel.com/account/tokens"
  exit 1
fi

upsert_env() {
  local key="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "Skip $key (empty)"
    return
  fi
  echo "Setting $key..."
  curl -fsS -X POST "https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_ORG_ID}&upsert=true" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg key "$key" --arg value "$value" \
      '{key: $key, value: $value, type: "encrypted", target: ["production","preview","development"]}')" \
    >/dev/null
}

upsert_env "TAVILY_API_KEY" "${TAVILY_API_KEY:-}"
upsert_env "TAVILY_MCP_KEY" "${TAVILY_MCP_KEY:-${TAVILY_API_KEY:-}}"
upsert_env "SERPER_API_KEY" "${SERPER_API_KEY:-}"
upsert_env "WEBSEARCH_API_KEY" "${WEBSEARCH_API_KEY:-}"
upsert_env "WEBSEARCH_API_URL" "${WEBSEARCH_API_URL:-https://api.websearchapi.ai/ai-search}"

echo ""
echo "Done. Push the validated release to main once; the Vercel Git integration creates the production deployment."
