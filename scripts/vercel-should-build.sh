#!/usr/bin/env bash
# Vercel ignoreCommand — exit 0 = skip build, exit 1 = proceed.
# Belt-and-suspenders with git.deploymentEnabled in vercel.json.
set -euo pipefail

REF="${VERCEL_GIT_COMMIT_REF:-unknown}"
ENV="${VERCEL_ENV:-unknown}"
PROJECT_ID="${VERCEL_PROJECT_ID:-unknown}"
CANONICAL_PROJECT_ID="prj_0xIUtSzxZ2Cqeie8eHYB6iPAKIN0"
DISCOVER_PREVIEW_REF="codex/discover-final-production"
DISCOVER_ACTIONS_PREVIEW_REF="codex/discover-economic-actions"
DISCOVER_COMPLETION_PREVIEW_REF="fix/discover-marketplace-completion"
DISCOVER_HYDRATION_PREVIEW_REF="fix/discover-hydration-and-phases"

if [ "$PROJECT_ID" != "$CANONICAL_PROJECT_ID" ]; then
  echo "skip: project $PROJECT_ID is not the canonical RESOLVE project"
  exit 0
fi

if [ "$REF" = "main" ] && [ "$ENV" = "production" ]; then
  echo "build: production main ($REF)"
  exit 1
fi

if [ "$ENV" = "preview" ] && { [ "$REF" = "$DISCOVER_PREVIEW_REF" ] || [ "$REF" = "$DISCOVER_ACTIONS_PREVIEW_REF" ] || [ "$REF" = "$DISCOVER_COMPLETION_PREVIEW_REF" ] || [ "$REF" = "$DISCOVER_HYDRATION_PREVIEW_REF" ]; }; then
  echo "build: verified Discover preview ($REF)"
  exit 1
fi

echo "skip: branch $REF is not an approved deployment target for VERCEL_ENV=$ENV"
exit 0
