-- =============================================================================
-- RESOLVE — paste this ENTIRE file into Supabase SQL Editor, then click Run.
-- Do NOT paste file paths like public/docs/foo.sql — paste the SQL below only.
-- =============================================================================

-- Earn notifications (claim links)
ALTER TABLE "PaymentAuthorization"
  ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);

-- Global settlement — contributor currency preference (USDC / EURC / cirBTC)
ALTER TABLE "ContributorRegistry"
  ADD COLUMN IF NOT EXISTS "payoutCurrency" TEXT NOT NULL DEFAULT 'USDC';
