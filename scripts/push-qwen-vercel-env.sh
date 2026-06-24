#!/usr/bin/env bash
# Push Qwen / DashScope env vars to Vercel via REST API.
# Requires: VERCEL_TOKEN (https://vercel.com/account/tokens)
# Usage:
#   export VERCEL_TOKEN=...
#   export DASHSCOPE_API_KEY=sk-ws-...
#   ./scripts/push-qwen-vercel-env.sh

set -euo pipefail

VERCEL_ORG_ID="${VERCEL_ORG_ID:-team_apDtKK364C3BW1LjG3M93rhI}"
VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-prj_bCorqG2sezHdXiRmedRRwV0Q7Rhd}"
BASE_URL="${QWEN_OPENAI_BASE_URL:-https://ws-yn23kv194w5nn7tx.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "Set VERCEL_TOKEN (Vercel → Account → Tokens)"
  exit 1
fi

if [[ -z "${DASHSCOPE_API_KEY:-}" ]]; then
  echo "Set DASHSCOPE_API_KEY"
  exit 1
fi

upsert_env() {
  local key="$1"
  local value="$2"
  echo "Setting $key on production, preview, development..."
  curl -fsS -X POST "https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_ORG_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg key "$key" \
      --arg value "$value" \
      '{key: $key, value: $value, type: "encrypted", target: ["production","preview","development"]}')" \
    >/dev/null || \
  curl -fsS -X PATCH "https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_ORG_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg key "$key" --arg value "$value" '{key: $key, value: $value}')" \
    >/dev/null || true
}

upsert_env "DASHSCOPE_API_KEY" "$DASHSCOPE_API_KEY"
upsert_env "QWEN_OPENAI_BASE_URL" "$BASE_URL"
upsert_env "QWEN_PLANNER_MODEL" "${QWEN_PLANNER_MODEL:-qwen-plus-2025-12-01}"
upsert_env "QWEN_FAST_MODEL" "${QWEN_FAST_MODEL:-qwen3.6-flash}"
upsert_env "QWEN_REASONING_MODEL" "${QWEN_REASONING_MODEL:-qwen3.6-max-preview}"

echo ""
echo "Env vars pushed. Trigger a NEW deployment (not prebuilt redeploy):"
echo "  curl -X POST https://api.vercel.com/v1/integrations/deploy/prj_bCorqG2sezHdXiRmedRRwV0Q7Rhd/krAQUtlB2i"
