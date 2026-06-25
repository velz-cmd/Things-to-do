#!/usr/bin/env bash
# Document remaining integration env vars for Vercel production.
# Run: ./scripts/setup-integrations-vercel-env.sh
# Requires: npx vercel login && npx vercel link
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== RESOLVE integration setup (Vercel env) ==="
echo ""
echo "Already configured (verify in Vercel dashboard):"
echo "  - AI stack: GEMINI, GROQ, OPENROUTER, CLOUDFLARE_*"
echo "  - Search: TAVILY, SERPER, WEBSEARCH"
echo "  - Arc: CIRCLE_*, ARC_CLIENT_WALLET_ADDRESS, ALCHEMY_API_KEY"
echo "  - DEPUTY_DEMO_MODE=false (production honesty)"
echo ""
echo "Still needed for full live behavior:"
echo ""
echo "1. Gmail OAuth (Radar live discovery)"
echo "   GOOGLE_CLIENT_ID=..."
echo "   GOOGLE_CLIENT_SECRET=..."
echo "   Redirect URI: https://resolve-task.vercel.app/api/connectors/gmail/callback"
echo "   Users connect via Radar → Connect Gmail"
echo ""
echo "2. WalletLabels (entity labels on wallet scan)"
echo "   WALLET_LABELS_API_KEY=...  # free at https://walletlabels.xyz"
echo ""
echo "3. Fund Arc treasury for on-chain memo payouts"
echo "   Send testnet USDC to ARC_CLIENT_WALLET_ADDRESS on Arc"
echo "   Check: GET /api/treasury/arc-readiness"
echo ""
echo "4. Circle Agent Stack (x402 agent pay)"
echo "   ARC_AGENT_GATEWAY_PRIVATE_KEY=0x...  # funded on Arc testnet"
echo "   Fund via https://faucet.circle.com → Arc Testnet USDC"
echo "   Agent pays /api/x402/premium-research at ~\$0.007 per mission"
echo ""
echo "5. Card deposits"
echo "   Disabled when DEPUTY_DEMO_MODE=false — use Add funds → Arc tab"
echo ""
echo "To push vars (example):"
echo '  npx vercel env add GOOGLE_CLIENT_ID production'
echo '  npx vercel env add WALLET_LABELS_API_KEY production'
echo ""
echo "CI deploy uses Vercel deploy hook only (.github/workflows/vercel-deploy.yml)"
