#!/usr/bin/env bash
# Vercel build — never connect to Postgres for migrations.
# Vercel build IPs cannot reliably reach Supabase direct (5432) and the
# transaction pooler (6543) cannot run DDL. Schema is applied via Supabase
# dashboard / MCP and healed at runtime (ensurePasswordResetSchema).
set -euo pipefail

export NEXT_TELEMETRY_DISABLED=1
export CI=1

echo "→ prisma generate"
npx prisma generate

echo "→ next build"
npx next build
