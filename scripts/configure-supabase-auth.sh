#!/usr/bin/env bash
# Patch Supabase Auth URL config via Management API.
# Requires: SUPABASE_ACCESS_TOKEN (from https://supabase.com/dashboard/account/tokens)
# Usage: SUPABASE_ACCESS_TOKEN=sbp_... ./scripts/configure-supabase-auth.sh

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-jjducnguljjddciczvuy}"
SITE_URL="${SITE_URL:-https://things-to-do-eta.vercel.app}"
REDIRECTS="${REDIRECT_ALLOW_LIST:-https://things-to-do-eta.vercel.app/**,http://localhost:3000/**}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Set SUPABASE_ACCESS_TOKEN to patch Supabase Auth URL configuration."
  exit 1
fi

curl -sS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"site_url\": \"${SITE_URL}\",
    \"uri_allow_list\": \"${REDIRECTS}\"
  }" | python3 -m json.tool

echo ""
echo "Supabase Auth URL config updated."
echo "Site URL: ${SITE_URL}"
echo "Redirect allow list: ${REDIRECTS}"
