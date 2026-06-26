-- Authorization Ledger (connector-agnostic). Run in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS "PaymentAuthorization" (
  "id" TEXT NOT NULL,
  "connectorId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payeeKeyType" TEXT NOT NULL,
  "payeeKey" TEXT NOT NULL,
  "amountUsd" DOUBLE PRECISION NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "proofHash" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
  "status" TEXT NOT NULL DEFAULT 'authorized',
  "contextLabel" TEXT,
  "evidenceJson" TEXT,
  "founderUserId" TEXT,
  "settlementId" TEXT,
  "walletAddress" TEXT,
  "fulfilledAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAuthorization_idempotencyKey_key"
  ON "PaymentAuthorization"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PaymentAuthorization_missionId_idx"
  ON "PaymentAuthorization"("missionId");
CREATE INDEX IF NOT EXISTS "PaymentAuthorization_connectorId_idx"
  ON "PaymentAuthorization"("connectorId");
CREATE INDEX IF NOT EXISTS "PaymentAuthorization_payeeKeyType_payeeKey_idx"
  ON "PaymentAuthorization"("payeeKeyType", "payeeKey");
CREATE INDEX IF NOT EXISTS "PaymentAuthorization_status_idx"
  ON "PaymentAuthorization"("status");
CREATE INDEX IF NOT EXISTS "PaymentAuthorization_proofHash_idx"
  ON "PaymentAuthorization"("proofHash");
