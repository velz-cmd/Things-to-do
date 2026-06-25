-- RESOLVE Payment Layer — CORRECT schema (matches prisma/schema.prisma)
-- Supabase → SQL Editor → New query → paste ALL → Run
--
-- ⚠️  Do NOT use the ChatGPT SQL with UUID + snake_case columns — it will NOT work with this app.
-- If you already ran that wrong SQL, run the CLEANUP block at the bottom first, then run this file.

-- ---------------------------------------------------------------------------
-- 0. User table — GitHub identity (skip if columns already exist)
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "githubUsername" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "githubId" TEXT;

-- ---------------------------------------------------------------------------
-- 1. ContributorRegistry — extend existing table OR create fresh
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ContributorRegistry" (
    "id"               TEXT NOT NULL,
    "platform"         TEXT,
    "platformId"       TEXT,
    "creatorName"      TEXT,
    "walletAddress"    TEXT,
    "githubUsername"   TEXT,
    "musicbrainzId"    TEXT,
    "exifArtist"       TEXT,
    "activitypubActor" TEXT,
    "verified"         BOOLEAN NOT NULL DEFAULT false,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContributorRegistry_pkey" PRIMARY KEY ("id")
);

-- New identity-protocol columns (safe if already exist)
ALTER TABLE "ContributorRegistry" ADD COLUMN IF NOT EXISTS "githubId" TEXT;
ALTER TABLE "ContributorRegistry" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'unlinked';
ALTER TABLE "ContributorRegistry" ADD COLUMN IF NOT EXISTS "proofScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ContributorRegistry" ADD COLUMN IF NOT EXISTS "claimableUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ContributorRegistry" ADD COLUMN IF NOT EXISTS "totalEarnedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ContributorRegistry" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

-- Wallet is optional now (contributors claim later)
ALTER TABLE "ContributorRegistry" ALTER COLUMN "walletAddress" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "ContributorRegistry_platform_platformId_idx"
    ON "ContributorRegistry"("platform", "platformId");
CREATE INDEX IF NOT EXISTS "ContributorRegistry_githubUsername_idx"
    ON "ContributorRegistry"("githubUsername");
CREATE INDEX IF NOT EXISTS "ContributorRegistry_githubId_idx"
    ON "ContributorRegistry"("githubId");
CREATE INDEX IF NOT EXISTS "ContributorRegistry_status_idx"
    ON "ContributorRegistry"("status");
CREATE INDEX IF NOT EXISTS "ContributorRegistry_exifArtist_idx"
    ON "ContributorRegistry"("exifArtist");

-- ---------------------------------------------------------------------------
-- 2. MissionSettlement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "MissionSettlement" (
    "id"             TEXT NOT NULL,
    "missionId"      TEXT NOT NULL,
    "repo"           TEXT,
    "treasuryAmount" DOUBLE PRECISION NOT NULL,
    "currency"       TEXT NOT NULL DEFAULT 'USDC',
    "proofHash"      TEXT NOT NULL,
    "confidence"     DOUBLE PRECISION NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'CREATED',
    "poolsJson"      TEXT,
    "packageJson"    TEXT,
    "auditHash"      TEXT,
    "escrowTxHash"   TEXT,
    "batchNumber"    INTEGER,
    "proofJson"      TEXT,
    "complianceJson" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissionSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MissionSettlement_missionId_key"
    ON "MissionSettlement"("missionId");
CREATE INDEX IF NOT EXISTS "MissionSettlement_proofHash_idx"
    ON "MissionSettlement"("proofHash");
CREATE INDEX IF NOT EXISTS "MissionSettlement_status_idx"
    ON "MissionSettlement"("status");

-- ---------------------------------------------------------------------------
-- 3. PendingReward
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PendingReward" (
    "id"             TEXT NOT NULL,
    "missionId"      TEXT NOT NULL,
    "repo"           TEXT,
    "githubUsername" TEXT NOT NULL,
    "githubId"       TEXT,
    "contributorId"  TEXT,
    "amountUsd"      DOUBLE PRECISION NOT NULL,
    "weight"         DOUBLE PRECISION NOT NULL,
    "proofHash"      TEXT NOT NULL,
    "confidence"     DOUBLE PRECISION NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'claimable',
    "founderUserId"  TEXT,
    "settlementId"   TEXT,
    "walletAddress"  TEXT,
    "claimedAt"      TIMESTAMP(3),
    "settledAt"      TIMESTAMP(3),
    "notifiedAt"     TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PendingReward_missionId_githubUsername_key"
    ON "PendingReward"("missionId", "githubUsername");
CREATE INDEX IF NOT EXISTS "PendingReward_githubUsername_idx"
    ON "PendingReward"("githubUsername");
CREATE INDEX IF NOT EXISTS "PendingReward_status_idx"
    ON "PendingReward"("status");
CREATE INDEX IF NOT EXISTS "PendingReward_proofHash_idx"
    ON "PendingReward"("proofHash");

DO $$ BEGIN
    ALTER TABLE "PendingReward"
        ADD CONSTRAINT "PendingReward_contributorId_fkey"
        FOREIGN KEY ("contributorId") REFERENCES "ContributorRegistry"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 4. PaymentIntent
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PaymentIntent" (
    "id"           TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "wallet"       TEXT NOT NULL,
    "login"        TEXT,
    "weight"       DOUBLE PRECISION NOT NULL,
    "amountUsd"    DOUBLE PRECISION NOT NULL,
    "rank"         INTEGER NOT NULL DEFAULT 0,
    "memoId"       TEXT,
    "memoText"     TEXT,
    "status"       TEXT NOT NULL DEFAULT 'pending',
    "txHash"       TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentIntent_wallet_idx" ON "PaymentIntent"("wallet");
CREATE INDEX IF NOT EXISTS "PaymentIntent_settlementId_idx" ON "PaymentIntent"("settlementId");

DO $$ BEGIN
    ALTER TABLE "PaymentIntent"
        ADD CONSTRAINT "PaymentIntent_settlementId_fkey"
        FOREIGN KEY ("settlementId") REFERENCES "MissionSettlement"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 5. SettlementNanoPayment
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "SettlementNanoPayment" (
    "id"              TEXT NOT NULL,
    "settlementId"    TEXT NOT NULL,
    "agentRole"       TEXT NOT NULL,
    "purpose"         TEXT NOT NULL,
    "amountUsd"       DOUBLE PRECISION NOT NULL,
    "recipientWallet" TEXT NOT NULL,
    "memoText"        TEXT NOT NULL,
    "txHash"          TEXT,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettlementNanoPayment_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "SettlementNanoPayment"
        ADD CONSTRAINT "SettlementNanoPayment_settlementId_fkey"
        FOREIGN KEY ("settlementId") REFERENCES "MissionSettlement"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 6. PaymentEvent
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PaymentEvent" (
    "id"           TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "type"         TEXT NOT NULL,
    "payloadJson"  TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentEvent_settlementId_idx" ON "PaymentEvent"("settlementId");
CREATE INDEX IF NOT EXISTS "PaymentEvent_type_idx" ON "PaymentEvent"("type");

DO $$ BEGIN
    ALTER TABLE "PaymentEvent"
        ADD CONSTRAINT "PaymentEvent_settlementId_fkey"
        FOREIGN KEY ("settlementId") REFERENCES "MissionSettlement"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Done — verify (should return 6 rows)
-- ---------------------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'ContributorRegistry',
    'MissionSettlement',
    'PendingReward',
    'PaymentIntent',
    'SettlementNanoPayment',
    'PaymentEvent'
  )
ORDER BY table_name;

-- =============================================================================
-- CLEANUP — only if you ran the WRONG ChatGPT SQL first
-- Uncomment and run this block, then run this file again from the top.
-- =============================================================================
/*
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "ContributorRegistry";
DROP POLICY IF EXISTS "Enable insert/update for authenticated users" ON "ContributorRegistry";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "PendingReward";
DROP POLICY IF EXISTS "Enable insert/update for authenticated users" ON "PendingReward";

DROP TABLE IF EXISTS "PaymentEvent" CASCADE;
DROP TABLE IF EXISTS "SettlementNanoPayment" CASCADE;
DROP TABLE IF EXISTS "PaymentIntent" CASCADE;
DROP TABLE IF EXISTS "PendingReward" CASCADE;
DROP TABLE IF EXISTS "MissionSettlement" CASCADE;
-- Only drop ContributorRegistry if ChatGPT created a fresh wrong one with no real data:
-- DROP TABLE IF EXISTS "ContributorRegistry" CASCADE;
*/
