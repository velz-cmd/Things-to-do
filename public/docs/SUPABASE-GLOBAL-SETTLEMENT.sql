-- Contributor payout currency preference (global settlement / optional FX)
ALTER TABLE "ContributorRegistry"
  ADD COLUMN IF NOT EXISTS "payoutCurrency" TEXT NOT NULL DEFAULT 'USDC';
