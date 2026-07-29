-- Restore additive tables present in the Prisma schema but absent from the
-- production database. IF NOT EXISTS keeps this migration safe for databases
-- that already received the older, out-of-order migrations.
CREATE TABLE IF NOT EXISTS "ResolveAutomationRule" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "installId" TEXT NOT NULL,
  "programId" TEXT,
  "communitySlug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "triggerEvent" TEXT NOT NULL,
  "authorizeUsd" DOUBLE PRECISION NOT NULL,
  "notifyChannel" TEXT NOT NULL DEFAULT 'email',
  "notifyTarget" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastFiredAt" TIMESTAMP(3),
  "lastFiredMeta" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResolveAutomationRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ResolveAutomationRule_installId_idx" ON "ResolveAutomationRule"("installId");
CREATE INDEX IF NOT EXISTS "ResolveAutomationRule_userId_idx" ON "ResolveAutomationRule"("userId");
CREATE INDEX IF NOT EXISTS "ResolveAutomationRule_communitySlug_idx" ON "ResolveAutomationRule"("communitySlug");
CREATE INDEX IF NOT EXISTS "ResolveAutomationRule_enabled_idx" ON "ResolveAutomationRule"("enabled");

CREATE TABLE IF NOT EXISTS "MissionBlueprintReceipt" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "communitySlug" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "packageJson" TEXT NOT NULL,
  "simulationJson" TEXT,
  "settlementJson" TEXT,
  "fundTxHash" TEXT,
  "fundTxLabel" TEXT,
  "programId" TEXT,
  "evidenceJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MissionBlueprintReceipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MissionBlueprintReceipt_communitySlug_createdAt_idx" ON "MissionBlueprintReceipt"("communitySlug", "createdAt");
CREATE INDEX IF NOT EXISTS "MissionBlueprintReceipt_userId_communitySlug_idx" ON "MissionBlueprintReceipt"("userId", "communitySlug");
CREATE INDEX IF NOT EXISTS "MissionBlueprintReceipt_status_idx" ON "MissionBlueprintReceipt"("status");

CREATE TABLE IF NOT EXISTS "DistributionBatch" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "platform" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "totalAmountUsd" DOUBLE PRECISION NOT NULL,
  "payeeCount" INTEGER NOT NULL,
  "eventCount" INTEGER NOT NULL,
  "verifiedCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "txHash" TEXT,
  "explorerUrl" TEXT,
  "complianceJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DistributionBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DistributionEvent" (
  "id" TEXT NOT NULL,
  "batchId" TEXT,
  "eventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "platform" TEXT,
  "platformId" TEXT,
  "category" TEXT NOT NULL DEFAULT 'distribution',
  "amountUsd" DOUBLE PRECISION NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "payeeWallet" TEXT,
  "payeeName" TEXT,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifyReason" TEXT,
  "confidence" DOUBLE PRECISION,
  "proofHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DistributionEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DistributionEvent_batchId_idx" ON "DistributionEvent"("batchId");
CREATE INDEX IF NOT EXISTS "DistributionEvent_eventId_idx" ON "DistributionEvent"("eventId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResolveAutomationRule_userId_fkey'
  ) THEN
    ALTER TABLE "ResolveAutomationRule"
      ADD CONSTRAINT "ResolveAutomationRule_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResolveAutomationRule_installId_fkey'
  ) THEN
    ALTER TABLE "ResolveAutomationRule"
      ADD CONSTRAINT "ResolveAutomationRule_installId_fkey"
      FOREIGN KEY ("installId") REFERENCES "ResolveCommunityInstall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResolveAutomationRule_programId_fkey'
  ) THEN
    ALTER TABLE "ResolveAutomationRule"
      ADD CONSTRAINT "ResolveAutomationRule_programId_fkey"
      FOREIGN KEY ("programId") REFERENCES "ResolveProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MissionBlueprintReceipt_userId_fkey'
  ) THEN
    ALTER TABLE "MissionBlueprintReceipt"
      ADD CONSTRAINT "MissionBlueprintReceipt_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DistributionEvent_batchId_fkey'
  ) THEN
    ALTER TABLE "DistributionEvent"
      ADD CONSTRAINT "DistributionEvent_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "DistributionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Preserve duplicate records for audit while allowing only one operational
-- program identity per community install and template.
WITH ranked_programs AS (
  SELECT
    p.id,
    FIRST_VALUE(p.id) OVER (
      PARTITION BY p."installId", p."templateId", lower(p.name)
      ORDER BY
        COALESCE((
          SELECT SUM(s."principalUsd")
          FROM "CommunityFundStake" s
          WHERE s."programId" = p.id
            AND s.status IN ('active', 'target_met')
        ), 0) DESC,
        (p."lastSettlementId" IS NOT NULL) DESC,
        p."updatedAt" DESC,
        p.id ASC
    ) AS canonical_id,
    ROW_NUMBER() OVER (
      PARTITION BY p."installId", p."templateId", lower(p.name)
      ORDER BY
        COALESCE((
          SELECT SUM(s."principalUsd")
          FROM "CommunityFundStake" s
          WHERE s."programId" = p.id
            AND s.status IN ('active', 'target_met')
        ), 0) DESC,
        (p."lastSettlementId" IS NOT NULL) DESC,
        p."updatedAt" DESC,
        p.id ASC
    ) AS rank
  FROM "ResolveProgram" p
  WHERE p.status IN ('active', 'deployed')
)
UPDATE "ResolveProgram" p
SET
  status = 'archived_duplicate',
  "metadataJson" = jsonb_build_object(
    'integrityState', 'quarantined_duplicate',
    'canonicalProgramId', ranked_programs.canonical_id,
    'quarantineReason', 'duplicate_active_program_identity',
    'quarantinedAt', CURRENT_TIMESTAMP,
    'previousMetadataJson', p."metadataJson"
  )::text,
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked_programs
WHERE p.id = ranked_programs.id
  AND ranked_programs.rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "ResolveProgram_active_identity_key"
  ON "ResolveProgram"("installId", "templateId", lower("name"))
  WHERE status IN ('active', 'deployed');

-- A July 2026 sync path stored micro-USDC values as USD. Keep the rows for
-- audit, but quarantine them so no customer-facing balance or statement can
-- count them as financial activity.
UPDATE "WalletTransaction"
SET
  status = 'quarantined_legacy_unit_error',
  label = 'quarantined:legacy_unit_error:' || COALESCE(label, 'sync:onchain')
WHERE label = 'sync:onchain'
  AND abs("amountUsd") >= 1000
  AND "createdAt" >= TIMESTAMP '2026-07-05 00:00:00'
  AND "createdAt" < TIMESTAMP '2026-07-07 00:00:00';

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ResolveAutomationRule',
    'MissionBlueprintReceipt',
    'DistributionBatch',
    'DistributionEvent'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM anon, authenticated', table_name);
  END LOOP;
END $$;
