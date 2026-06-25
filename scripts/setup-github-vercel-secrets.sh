#!/usr/bin/env bash
# Push Vercel credentials to GitHub Actions secrets (run locally after `gh auth login`).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v gh &>/dev/null; then
  echo "Install GitHub CLI: https://cli.github.com/"
  exit 1
fi

AUTH_JSON="${HOME}/.local/share/com.vercel.cli/auth.json"
REPO_JSON=".vercel/project.json"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  if [[ -f "$AUTH_JSON" ]]; then
    VERCEL_TOKEN=$(python3 -c "import json; print(json.load(open('$AUTH_JSON'))['token'])")
  else
    echo "Set VERCEL_TOKEN or run: npx vercel login"
    exit 1
  fi
fi

if [[ -f "$REPO_JSON" ]]; then
  VERCEL_PROJECT_ID=$(python3 -c "import json; print(json.load(open('$REPO_JSON'))['projectId'])")
  VERCEL_ORG_ID=$(python3 -c "import json; print(json.load(open('$REPO_JSON'))['orgId'])")
elif [[ -f ".vercel/repo.json" ]]; then
  VERCEL_PROJECT_ID=$(python3 -c "import json; d=json.load(open('.vercel/repo.json')); print(d['projects'][0]['id'])")
  VERCEL_ORG_ID=$(python3 -c "import json; d=json.load(open('.vercel/repo.json')); print(d['projects'][0]['orgId'])")
else
  echo "Run: npx vercel link"
  exit 1
fi

echo "Setting GitHub secrets for $(gh repo view --json nameWithOwner -q .nameWithOwner)..."
gh secret set VERCEL_TOKEN --body "$VERCEL_TOKEN"
gh secret set VERCEL_ORG_ID --body "$VERCEL_ORG_ID"
gh secret set VERCEL_PROJECT_ID --body "$VERCEL_PROJECT_ID"

if [[ -f ".vercel-deploy-hook" ]]; then
  gh secret set VERCEL_DEPLOY_HOOK --body "$(cat .vercel-deploy-hook)"
fi

echo "Done. CI uses deploy hook only — VERCEL_TOKEN is optional for local CLI deploys."
