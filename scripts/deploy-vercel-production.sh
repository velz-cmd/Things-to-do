#!/usr/bin/env bash
# One-command Vercel env sync + production deploy (run on YOUR machine after vercel login).
# Usage:
#   npx vercel login
#   ./scripts/deploy-vercel-production.sh

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env — copy from teammate or fill .env.example"
  exit 1
fi

echo "==> Syncing environment variables to Vercel..."
./scripts/sync-vercel-env.sh

echo ""
echo "==> Deploying production..."
npx vercel@54 deploy --prod --yes

echo ""
echo "==> Verify:"
echo "  https://things-to-do-eta.vercel.app/api/health/env"
echo "  https://things-to-do-eta.vercel.app/demo-portals/streamly"
