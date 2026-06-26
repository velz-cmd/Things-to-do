-- AlterTable
ALTER TABLE "ContributorRegistry" ADD COLUMN IF NOT EXISTS "payoutCurrency" TEXT NOT NULL DEFAULT 'USDC';
