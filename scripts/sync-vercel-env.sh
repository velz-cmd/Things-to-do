#!/usr/bin/env bash
# Push local .env vars to Vercel (Production + Preview + Development).
# Requires: npm i -g vercel && vercel login
# Usage: ./scripts/sync-vercel-env.sh

set -euo pipefail

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and fill in values."
  exit 1
fi

if ! command -v vercel &>/dev/null; then
  vercel() { npx vercel@54 "$@"; }
fi

# Vars required for RESOLVE on Vercel
VARS=(
  DATABASE_URL
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_REOWN_PROJECT_ID
  NEXT_PUBLIC_APP_URL
  APP_URL
  NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS
  NEXT_PUBLIC_RESOLVE_AGENT_ADDRESS
  DEPUTY_ORACLE_PRIVATE_KEY
  DEPUTY_DEMO_MODE
  NEXT_PUBLIC_DEPUTY_DEMO_MODE
  RESEND_API_KEY
  RESEND_FROM_EMAIL
  RESEND_CLAIM_TO
  GEMINI_API_KEY
  GOOGLE_GENERATIVE_AI_API_KEY
  GROQ_API_KEY
  OPENROUTER_API_KEY
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_AI_GATEWAY_ID
  CLOUDFLARE_API_TOKEN
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  CRON_SECRET
  CIRCLE_API_KEY
  CIRCLE_ENTITY_SECRET
  ARC_RPC_URL
  ARC_CHAIN_ID
  ARC_EXPLORER_URL
  ARC_AGENTIC_COMMERCE_CONTRACT
  ARC_USDC_CONTRACT
  ARC_PROVIDER_WALLET_ID
  ARC_CLIENT_WALLET_ID
  ARC_PROVIDER_WALLET_ADDRESS
  ARC_CLIENT_WALLET_ADDRESS
  PLAYWRIGHT_ENABLED
  NEXT_PUBLIC_ARC_CHAIN_ID
  NEXT_PUBLIC_USDC_ADDRESS
)

echo "Linking project (if needed)..."
vercel link --yes 2>/dev/null || true

for key in "${VARS[@]}"; do
  value=$(grep -E "^${key}=" .env | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//')
  if [[ -z "${value:-}" ]]; then
    echo "Skip $key (empty in .env)"
    continue
  fi
  echo "Setting $key on Production, Preview, Development..."
  printf '%s' "$value" | vercel env add "$key" production --force 2>/dev/null || true
  printf '%s' "$value" | vercel env add "$key" preview --force 2>/dev/null || true
  printf '%s' "$value" | vercel env add "$key" development --force 2>/dev/null || true
done

echo ""
echo "Done. Redeploy: vercel deploy --prod"
echo "Escrow contract must be 0x4e9b728a3c46315d8ec4df19b972f78b1a4f669f"
echo "Agent oracle must NOT be used as escrow address."
