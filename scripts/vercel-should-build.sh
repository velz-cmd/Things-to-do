#!/usr/bin/env bash
# Vercel ignoreCommand — exit 0 = skip build, exit 1 = proceed.
# Belt-and-suspenders with git.deploymentEnabled in vercel.json (main only).
set -euo pipefail

REF="${VERCEL_GIT_COMMIT_REF:-unknown}"
ENV="${VERCEL_ENV:-unknown}"
PROJECT_ID="${VERCEL_PROJECT_ID:-unknown}"
CANONICAL_PROJECT_ID="prj_0xIUtSzxZ2Cqeie8eHYB6iPAKIN0"

if [ "$PROJECT_ID" != "$CANONICAL_PROJECT_ID" ]; then
  echo "skip: project $PROJECT_ID is not the canonical RESOLVE project"
  exit 0
fi

if [ "$REF" != "main" ]; then
  echo "skip: branch $REF is not main (preview/cursor deploys disabled)"
  exit 0
fi

if [ "$ENV" != "production" ]; then
  echo "skip: VERCEL_ENV=$ENV (only production main builds)"
  exit 0
fi

echo "build: production main ($REF)"
exit 1
