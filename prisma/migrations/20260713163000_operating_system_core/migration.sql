-- Additive operating-system core. Existing product tables remain untouched.
CREATE TABLE "Wallet" (
  "id" TEXT NOT NULL, "userId" TEXT, "ownerType" TEXT NOT NULL, "custodyType" TEXT NOT NULL,
  "provider" TEXT NOT NULL, "providerWalletId" TEXT, "network" TEXT NOT NULL, "address" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active', "spendingPolicy" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Wallet_provider_network_address_key" ON "Wallet"("provider", "network", "address");
CREATE INDEX "Wallet_userId_ownerType_idx" ON "Wallet"("userId", "ownerType");
CREATE INDEX "Wallet_providerWalletId_idx" ON "Wallet"("providerWalletId");

CREATE TABLE "PayoutDestination" (
  "id" TEXT NOT NULL, "userId" TEXT, "identityId" TEXT, "walletId" TEXT, "network" TEXT NOT NULL,
  "address" TEXT NOT NULL, "asset" TEXT NOT NULL DEFAULT 'USDC', "status" TEXT NOT NULL DEFAULT 'pending',
  "proofJson" JSONB, "verifiedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PayoutDestination_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PayoutDestination_userId_status_idx" ON "PayoutDestination"("userId", "status");
CREATE INDEX "PayoutDestination_identityId_idx" ON "PayoutDestination"("identityId");
CREATE INDEX "PayoutDestination_network_address_idx" ON "PayoutDestination"("network", "address");

CREATE TABLE "SourceConnection" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "communitySlug" TEXT, "provider" TEXT NOT NULL,
  "externalAccountId" TEXT, "displayLabel" TEXT, "status" TEXT NOT NULL DEFAULT 'connected',
  "capabilitiesJson" JSONB, "secretRef" TEXT, "authExpiresAt" TIMESTAMP(3), "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SourceConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SourceConnection_userId_provider_externalAccountId_key" ON "SourceConnection"("userId", "provider", "externalAccountId");
CREATE INDEX "SourceConnection_userId_status_idx" ON "SourceConnection"("userId", "status");
CREATE INDEX "SourceConnection_communitySlug_status_idx" ON "SourceConnection"("communitySlug", "status");

CREATE TABLE "SourceSyncRun" (
  "id" TEXT NOT NULL, "sourceConnectionId" TEXT NOT NULL, "communitySlug" TEXT, "status" TEXT NOT NULL DEFAULT 'queued',
  "cursor" TEXT, "evidenceCount" INTEGER NOT NULL DEFAULT 0, "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "errorCode" TEXT, "errorMessage" TEXT, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SourceSyncRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SourceSyncRun_sourceConnectionId_createdAt_idx" ON "SourceSyncRun"("sourceConnectionId", "createdAt");
CREATE INDEX "SourceSyncRun_communitySlug_status_idx" ON "SourceSyncRun"("communitySlug", "status");

CREATE TABLE "Evidence" (
  "id" TEXT NOT NULL, "sourceConnectionId" TEXT, "syncRunId" TEXT, "communitySlug" TEXT, "externalId" TEXT NOT NULL,
  "kind" TEXT NOT NULL, "subjectRef" TEXT NOT NULL, "actorRef" TEXT, "occurredAt" TIMESTAMP(3) NOT NULL,
  "contentHash" TEXT NOT NULL, "sourceUrl" TEXT, "payload" JSONB NOT NULL, "confidencePpm" INTEGER NOT NULL DEFAULT 1000000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Evidence_kind_externalId_contentHash_key" ON "Evidence"("kind", "externalId", "contentHash");
CREATE INDEX "Evidence_communitySlug_occurredAt_idx" ON "Evidence"("communitySlug", "occurredAt");
CREATE INDEX "Evidence_subjectRef_idx" ON "Evidence"("subjectRef");
CREATE INDEX "Evidence_actorRef_idx" ON "Evidence"("actorRef");

CREATE TABLE "Identity" (
  "id" TEXT NOT NULL, "userId" TEXT, "communitySlug" TEXT, "canonicalRef" TEXT NOT NULL, "displayName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'observed', "confidencePpm" INTEGER NOT NULL DEFAULT 0, "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB, "verifiedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Identity_canonicalRef_key" ON "Identity"("canonicalRef");
CREATE INDEX "Identity_userId_status_idx" ON "Identity"("userId", "status");
CREATE INDEX "Identity_communitySlug_status_idx" ON "Identity"("communitySlug", "status");

CREATE TABLE "ObservedIdentity" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "communitySlug" TEXT NOT NULL, "provider" TEXT NOT NULL, "externalRef" TEXT NOT NULL,
  "displayLabel" TEXT, "status" TEXT NOT NULL DEFAULT 'observed', "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "payoutDestinationId" TEXT, "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "ObservedIdentity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ObservedIdentity_userId_communitySlug_provider_externalRef_key" ON "ObservedIdentity"("userId", "communitySlug", "provider", "externalRef");
CREATE INDEX "ObservedIdentity_userId_communitySlug_status_idx" ON "ObservedIdentity"("userId", "communitySlug", "status");
CREATE INDEX "ObservedIdentity_communitySlug_status_idx" ON "ObservedIdentity"("communitySlug", "status");
CREATE INDEX "ObservedIdentity_externalRef_idx" ON "ObservedIdentity"("externalRef");

CREATE TABLE "IdentityCandidate" (
  "id" TEXT NOT NULL, "observedIdentityId" TEXT NOT NULL, "identityId" TEXT, "candidateRef" TEXT NOT NULL,
  "displayName" TEXT, "confidencePpm" INTEGER NOT NULL, "confidenceFactors" JSONB NOT NULL,
  "contradictingData" JSONB, "modelProvider" TEXT, "modelVersion" TEXT,
  "status" TEXT NOT NULL DEFAULT 'suggested', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "IdentityCandidate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IdentityCandidate_observedIdentityId_candidateRef_key" ON "IdentityCandidate"("observedIdentityId", "candidateRef");
CREATE INDEX "IdentityCandidate_observedIdentityId_status_idx" ON "IdentityCandidate"("observedIdentityId", "status");
CREATE INDEX "IdentityCandidate_identityId_idx" ON "IdentityCandidate"("identityId");

CREATE TABLE "IdentityResolution" (
  "id" TEXT NOT NULL, "observedIdentityId" TEXT NOT NULL, "candidateId" TEXT, "identityId" TEXT,
  "action" TEXT NOT NULL, "method" TEXT NOT NULL, "resolvedBy" TEXT NOT NULL,
  "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[], "previousState" TEXT NOT NULL, "newState" TEXT NOT NULL,
  "modelProvider" TEXT, "modelVersion" TEXT, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityResolution_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IdentityResolution_observedIdentityId_createdAt_idx" ON "IdentityResolution"("observedIdentityId", "createdAt");
CREATE INDEX "IdentityResolution_identityId_idx" ON "IdentityResolution"("identityId");
CREATE INDEX "IdentityResolution_resolvedBy_createdAt_idx" ON "IdentityResolution"("resolvedBy", "createdAt");

CREATE TABLE "IdentityClaim" (
  "id" TEXT NOT NULL, "observedIdentityId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'submitted', "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[], "note" TEXT,
  "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "IdentityClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IdentityClaim_observedIdentityId_userId_key" ON "IdentityClaim"("observedIdentityId", "userId");
CREATE INDEX "IdentityClaim_userId_status_idx" ON "IdentityClaim"("userId", "status");
CREATE INDEX "IdentityClaim_observedIdentityId_status_idx" ON "IdentityClaim"("observedIdentityId", "status");

CREATE TABLE "ProgramVersion" (
  "id" TEXT NOT NULL, "programId" TEXT NOT NULL, "version" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft',
  "snapshot" JSONB NOT NULL, "createdBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProgramVersion_programId_version_key" ON "ProgramVersion"("programId", "version");
CREATE INDEX "ProgramVersion_programId_status_idx" ON "ProgramVersion"("programId", "status");

CREATE TABLE "PolicyVersion" (
  "id" TEXT NOT NULL, "programVersionId" TEXT NOT NULL, "version" INTEGER NOT NULL, "evidenceRule" JSONB NOT NULL,
  "eligibilityRule" JSONB NOT NULL, "allocationRule" JSONB NOT NULL, "settlementRule" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL, "createdBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PolicyVersion_programVersionId_version_key" ON "PolicyVersion"("programVersionId", "version");
CREATE INDEX "PolicyVersion_contentHash_idx" ON "PolicyVersion"("contentHash");

CREATE TABLE "Obligation" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "communitySlug" TEXT NOT NULL, "programVersionId" TEXT NOT NULL, "policyVersionId" TEXT NOT NULL,
  "identityId" TEXT, "payoutDestinationId" TEXT, "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[], "amountUsdcMicro" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'recognized', "blockerCode" TEXT, "settlementBatchId" TEXT, "lineageHash" TEXT NOT NULL,
  "recognizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Obligation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Obligation_lineageHash_key" ON "Obligation"("lineageHash");
CREATE INDEX "Obligation_communitySlug_status_idx" ON "Obligation"("communitySlug", "status");
CREATE INDEX "Obligation_userId_communitySlug_status_idx" ON "Obligation"("userId", "communitySlug", "status");
CREATE INDEX "Obligation_programVersionId_status_idx" ON "Obligation"("programVersionId", "status");
CREATE INDEX "Obligation_identityId_idx" ON "Obligation"("identityId");

CREATE TABLE "Blueprint" (
  "id" TEXT NOT NULL, "userId" TEXT, "missionId" TEXT NOT NULL, "communitySlug" TEXT, "programId" TEXT, "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft', "objective" JSONB NOT NULL, "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "payees" JSONB NOT NULL, "policy" JSONB NOT NULL, "fundingRequirementUsdcMicro" BIGINT NOT NULL,
  "settlementPath" JSONB NOT NULL, "contentHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Blueprint_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Blueprint_missionId_version_key" ON "Blueprint"("missionId", "version");
CREATE INDEX "Blueprint_communitySlug_status_idx" ON "Blueprint"("communitySlug", "status");
CREATE INDEX "Blueprint_contentHash_idx" ON "Blueprint"("contentHash");

CREATE TABLE "Simulation" (
  "id" TEXT NOT NULL, "blueprintId" TEXT NOT NULL, "version" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'completed',
  "inputHash" TEXT NOT NULL, "result" JSONB NOT NULL, "totalUsdcMicro" BIGINT NOT NULL, "fundingGapUsdcMicro" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Simulation_blueprintId_version_key" ON "Simulation"("blueprintId", "version");
CREATE INDEX "Simulation_inputHash_idx" ON "Simulation"("inputHash");

CREATE TABLE "FundingIntent" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "blueprintId" TEXT, "communitySlug" TEXT, "programId" TEXT,
  "amountUsdcMicro" BIGINT NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft', "idempotencyKey" TEXT NOT NULL,
  "returnTo" TEXT, "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FundingIntent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FundingIntent_idempotencyKey_key" ON "FundingIntent"("idempotencyKey");
CREATE INDEX "FundingIntent_userId_status_idx" ON "FundingIntent"("userId", "status");
CREATE INDEX "FundingIntent_communitySlug_status_idx" ON "FundingIntent"("communitySlug", "status");

CREATE TABLE "SettlementBatch" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "communitySlug" TEXT, "fundingIntentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'prepared', "totalUsdcMicro" BIGINT NOT NULL, "payeeCount" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "simulationId" TEXT, "preparedPackage" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3), "confirmedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SettlementBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SettlementBatch_idempotencyKey_key" ON "SettlementBatch"("idempotencyKey");
CREATE INDEX "SettlementBatch_userId_status_idx" ON "SettlementBatch"("userId", "status");
CREATE INDEX "SettlementBatch_communitySlug_status_idx" ON "SettlementBatch"("communitySlug", "status");

CREATE TABLE "ChainTransaction" (
  "id" TEXT NOT NULL, "settlementBatchId" TEXT, "fundingIntentId" TEXT, "provider" TEXT NOT NULL, "providerTransactionId" TEXT,
  "chainId" INTEGER NOT NULL, "txHash" TEXT, "fromAddress" TEXT, "toAddress" TEXT, "amountUsdcMicro" BIGINT,
  "status" TEXT NOT NULL DEFAULT 'submitted', "blockNumber" BIGINT, "failureCode" TEXT, "failureMessage" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "confirmedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChainTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChainTransaction_chainId_txHash_key" ON "ChainTransaction"("chainId", "txHash");
CREATE INDEX "ChainTransaction_settlementBatchId_status_idx" ON "ChainTransaction"("settlementBatchId", "status");
CREATE INDEX "ChainTransaction_fundingIntentId_status_idx" ON "ChainTransaction"("fundingIntentId", "status");
CREATE INDEX "ChainTransaction_providerTransactionId_idx" ON "ChainTransaction"("providerTransactionId");

CREATE TABLE "Receipt" (
  "id" TEXT NOT NULL, "settlementBatchId" TEXT NOT NULL, "chainTransactionId" TEXT NOT NULL, "communitySlug" TEXT,
  "publicReference" TEXT NOT NULL, "totalUsdcMicro" BIGINT NOT NULL, "payeeCount" INTEGER NOT NULL, "payload" JSONB NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Receipt_publicReference_key" ON "Receipt"("publicReference");
CREATE UNIQUE INDEX "Receipt_settlementBatchId_key" ON "Receipt"("settlementBatchId");
CREATE INDEX "Receipt_communitySlug_issuedAt_idx" ON "Receipt"("communitySlug", "issuedAt");

CREATE TABLE "OperationalEvent" (
  "id" TEXT NOT NULL, "eventType" TEXT NOT NULL, "aggregateType" TEXT NOT NULL, "aggregateId" TEXT NOT NULL,
  "userId" TEXT, "communitySlug" TEXT, "correlationId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OperationalEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperationalEvent_idempotencyKey_key" ON "OperationalEvent"("idempotencyKey");
CREATE INDEX "OperationalEvent_aggregateType_aggregateId_occurredAt_idx" ON "OperationalEvent"("aggregateType", "aggregateId", "occurredAt");
CREATE INDEX "OperationalEvent_userId_occurredAt_idx" ON "OperationalEvent"("userId", "occurredAt");
CREATE INDEX "OperationalEvent_communitySlug_occurredAt_idx" ON "OperationalEvent"("communitySlug", "occurredAt");
CREATE INDEX "OperationalEvent_correlationId_idx" ON "OperationalEvent"("correlationId");

CREATE TABLE "OutboxEvent" (
  "id" TEXT NOT NULL, "operationalEventId" TEXT NOT NULL, "topic" TEXT NOT NULL, "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL, "payload" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0, "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3), "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutboxEvent_operationalEventId_key" ON "OutboxEvent"("operationalEventId");
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL, "provider" TEXT NOT NULL, "providerEventId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "signatureValid" BOOLEAN NOT NULL, "status" TEXT NOT NULL DEFAULT 'received', "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" TIMESTAMP(3), "errorMessage" TEXT,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebhookEvent_provider_providerEventId_key" ON "WebhookEvent"("provider", "providerEventId");
CREATE INDEX "WebhookEvent_provider_status_receivedAt_idx" ON "WebhookEvent"("provider", "status", "receivedAt");

CREATE TABLE "IdempotencyRecord" (
  "key" TEXT NOT NULL, "scope" TEXT NOT NULL, "userId" TEXT, "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'started', "response" JSONB, "errorCode" TEXT, "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "IdempotencyRecord_scope_userId_createdAt_idx" ON "IdempotencyRecord"("scope", "userId", "createdAt");
CREATE INDEX "IdempotencyRecord_status_expiresAt_idx" ON "IdempotencyRecord"("status", "expiresAt");

-- These lifecycle tables are internal application infrastructure. Keep them
-- unavailable to Supabase's Data API unless explicit policies are introduced
-- in a later, reviewed migration. Direct server-side PostgreSQL access is
-- unaffected, and service-role access continues to bypass RLS as designed.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Wallet', 'PayoutDestination', 'SourceConnection', 'SourceSyncRun',
    'Evidence', 'Identity', 'ObservedIdentity', 'IdentityCandidate',
    'IdentityResolution', 'IdentityClaim', 'ProgramVersion', 'PolicyVersion',
    'Obligation', 'Blueprint', 'Simulation', 'FundingIntent',
    'SettlementBatch', 'ChainTransaction', 'Receipt', 'OperationalEvent',
    'OutboxEvent', 'WebhookEvent', 'IdempotencyRecord'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM anon, authenticated', table_name);
  END LOOP;
END $$;
