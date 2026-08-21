#!/usr/bin/env bash
# CI-equivalent local preflight for the Discover release branch.
#
# Runs the same gates .github/workflows/playwright-e2e.yml runs, in the
# same order, so a red GitHub check is never a surprise after a "tests
# pass locally" claim. Fails fast on the first red gate, exactly like CI.
#
# Skips the authenticated Playwright E2E step (needs live Supabase/E2E
# secrets this environment doesn't have) - everything before it, which is
# also everything that has actually broken CI so far, runs for real.
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

step "Generate Prisma client"
npx prisma generate

step "Validate Prisma schema"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/resolve_schema_validation" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/resolve_schema_validation" \
  npx prisma validate

step "Verify Prisma formatting"
npx prisma format
git diff --exit-code -- prisma/schema.prisma

step "Validate TypeScript"
npx tsc --noEmit

step "Run ESLint"
npm run lint

step "Run unit tests"
npx vitest run

step "Run lifecycle tests"
npm run test:operating-system

step "Run settlement integration tests"
NODE_OPTIONS="--max-old-space-size=4096 --conditions=react-server" npm run test:settlement

step "Discover Playwright tests (list only, syntax/collection check)"
npx playwright test --list

step "Build application"
CI=1 npm run build

echo
echo "All CI-equivalent gates passed. (Authenticated Playwright E2E was not run - it needs live E2E secrets this environment doesn't have; that step must still be verified in the real GitHub Actions run.)"
