-- Mission Blueprint decision receipts (Phase 6)
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

DO $$ BEGIN
    ALTER TABLE "MissionBlueprintReceipt" ADD CONSTRAINT "MissionBlueprintReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
