CREATE TABLE IF NOT EXISTS "SupporterBenefitLedger" (
    "id" TEXT NOT NULL,
    "stakeId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "benefitKey" TEXT NOT NULL,
    "benefitLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "policyVersion" TEXT,
    "activationCheckpointUsd" DOUBLE PRECISION,
    "policySnapshot" JSONB NOT NULL,
    "limitations" JSONB,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupporterBenefitLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupporterBenefitLedger_stakeId_benefitKey_key"
ON "SupporterBenefitLedger"("stakeId", "benefitKey");

CREATE INDEX IF NOT EXISTS "SupporterBenefitLedger_userId_status_createdAt_idx"
ON "SupporterBenefitLedger"("userId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "SupporterBenefitLedger_programId_status_idx"
ON "SupporterBenefitLedger"("programId", "status");

CREATE INDEX IF NOT EXISTS "SupporterBenefitLedger_stakeId_idx"
ON "SupporterBenefitLedger"("stakeId");

-- The application accesses this ledger through authenticated server routes.
-- Keep direct PostgREST access closed unless an explicit policy is added.
ALTER TABLE "SupporterBenefitLedger" ENABLE ROW LEVEL SECURITY;
