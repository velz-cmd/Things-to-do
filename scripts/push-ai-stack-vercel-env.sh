#!/usr/bin/env bash
# Push multi-tier AI env vars to Vercel (Gemini, Groq, OpenRouter, Cloudflare).
# Requires VERCEL_TOKEN + provider keys in environment (never commit secrets).
#
# Usage:
#   export VERCEL_TOKEN=...
#   export GROQ_API_KEY=gsk_...
#   export OPENROUTER_API_KEY=sk-or-v1-...
#   export GEMINI_API_KEY=...
#   export CLOUDFLARE_ACCOUNT_ID=...
#   export CLOUDFLARE_API_TOKEN=cfat_...
#   ./scripts/push-ai-stack-vercel-env.sh

set -euo pipefail

VERCEL_ORG_ID="${VERCEL_ORG_ID:-team_apDtKK364C3BW1LjG3M93rhI}"
VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-prj_bCorqG2sezHdXiRmedRRwV0Q7Rhd}"

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

upsert_env "GROQ_API_KEY" "${GROQ_API_KEY:-}"
upsert_env "OPENROUTER_API_KEY" "${OPENROUTER_API_KEY:-}"
upsert_env "GEMINI_API_KEY" "${GEMINI_API_KEY:-}"
upsert_env "GOOGLE_GENERATIVE_AI_API_KEY" "${GOOGLE_GENERATIVE_AI_API_KEY:-}"
upsert_env "CLOUDFLARE_ACCOUNT_ID" "${CLOUDFLARE_ACCOUNT_ID:-}"
upsert_env "CLOUDFLARE_AI_GATEWAY_ID" "${CLOUDFLARE_AI_GATEWAY_ID:-resolve}"
upsert_env "CLOUDFLARE_AI_GATEWAY_ENABLED" "${CLOUDFLARE_AI_GATEWAY_ENABLED:-false}"
upsert_env "CLOUDFLARE_API_TOKEN" "${CLOUDFLARE_API_TOKEN:-}"

echo ""
echo "Done. Trigger NEW deployment (not prebuilt redeploy):"
echo "  curl -X POST https://api.vercel.com/v1/integrations/deploy/prj_bCorqG2sezHdXiRmedRRwV0Q7Rhd/krAQUtlB2i"
