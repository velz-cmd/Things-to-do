#!/usr/bin/env bash
# DEPRECATED for CI — Vercel Git integration deploys on push.
# VERCEL_TOKEN in GitHub secrets caused duplicate CLI deploys and rate-limit failures.
# Use: GitHub Actions → Verify Vercel Production → workflow_dispatch + trigger_deploy_hook
set -euo pipefail
cd "$(dirname "$0")/.."

echo "This script is deprecated for GitHub Actions deploy."
echo ""
echo "Deploy flow:"
echo "  1. Push to main → Vercel Git integration deploys automatically"
echo "  2. GitHub Actions verifies https://resolve-self.vercel.app/api/health/env"
echo ""
echo "If you previously ran this and set VERCEL_TOKEN, remove it:"
echo "  gh secret delete VERCEL_TOKEN"
echo ""
echo "Manual redeploy: GitHub → Actions → Verify Vercel Production → Run workflow"
echo "  → check 'trigger_deploy_hook'"
