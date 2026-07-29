-- Canonical, source-neutral Discover marketplace records.
CREATE TABLE "DiscoverOpportunity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "creatorType" TEXT NOT NULL,
    "creatorId" TEXT,
    "creatorName" TEXT NOT NULL,
    "creatorAvatar" TEXT,
    "communityId" TEXT,
    "communityName" TEXT,
    "poolId" TEXT,
    "poolName" TEXT,
    "projectId" TEXT,
    "repository" TEXT,
    "category" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "deliverables" JSONB NOT NULL DEFAULT '[]',
    "evidenceRequirements" JSONB NOT NULL DEFAULT '[]',
    "eligibility" JSONB NOT NULL DEFAULT '[]',
    "rewardAmountUsd" DOUBLE PRECISION,
    "rewardToken" TEXT,
    "rewardNetwork" TEXT,
    "fundedAmountUsd" DOUBLE PRECISION,
    "fundingGoalUsd" DOUBLE PRECISION,
    "fundingStatus" TEXT,
    "paymentMode" TEXT,
    "distributionMethod" TEXT,
    "preferredProviderId" TEXT,
    "preferredProviderName" TEXT,
    "selectedProviderId" TEXT,
    "selectedProviderName" TEXT,
    "applicationCount" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER,
    "deadline" TIMESTAMP(3),
    "location" TEXT,
    "remote" BOOLEAN,
    "estimatedDelivery" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "riskFlags" JSONB NOT NULL DEFAULT '[]',
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiscoverOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoverImportRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "requestId" TEXT NOT NULL,
    "startedByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscoverImportRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoverImportRecord" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "validationResult" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "duplicateOpportunityId" TEXT,
    "normalizedOpportunityId" TEXT,
    "publishedStatus" TEXT,
    "inputPayload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscoverImportRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoverSavedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscoverSavedItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoverApplication" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "proposal" TEXT NOT NULL,
    "evidenceLinks" JSONB NOT NULL DEFAULT '[]',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiscoverApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoverProviderSelection" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "selectedBy" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preferred',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiscoverProviderSelection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoverOpportunityActivity" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscoverOpportunityActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscoverOpportunity_slug_key" ON "DiscoverOpportunity"("slug");
CREATE UNIQUE INDEX "DiscoverOpportunity_sourceType_sourceId_key" ON "DiscoverOpportunity"("sourceType", "sourceId");
CREATE INDEX "DiscoverOpportunity_visibility_status_publishedAt_idx" ON "DiscoverOpportunity"("visibility", "status", "publishedAt");
CREATE INDEX "DiscoverOpportunity_type_status_publishedAt_idx" ON "DiscoverOpportunity"("type", "status", "publishedAt");
CREATE INDEX "DiscoverOpportunity_communityId_status_publishedAt_idx" ON "DiscoverOpportunity"("communityId", "status", "publishedAt");
CREATE INDEX "DiscoverOpportunity_poolId_status_publishedAt_idx" ON "DiscoverOpportunity"("poolId", "status", "publishedAt");
CREATE INDEX "DiscoverOpportunity_creatorId_status_publishedAt_idx" ON "DiscoverOpportunity"("creatorId", "status", "publishedAt");
CREATE INDEX "DiscoverOpportunity_fundingStatus_status_publishedAt_idx" ON "DiscoverOpportunity"("fundingStatus", "status", "publishedAt");
CREATE INDEX "DiscoverOpportunity_deadline_idx" ON "DiscoverOpportunity"("deadline");
CREATE INDEX "DiscoverOpportunity_rewardAmountUsd_idx" ON "DiscoverOpportunity"("rewardAmountUsd");
CREATE INDEX "DiscoverImportRun_source_startedAt_idx" ON "DiscoverImportRun"("source", "startedAt");
CREATE INDEX "DiscoverImportRun_status_startedAt_idx" ON "DiscoverImportRun"("status", "startedAt");
CREATE UNIQUE INDEX "DiscoverImportRecord_runId_sourceRecordId_key" ON "DiscoverImportRecord"("runId", "sourceRecordId");
CREATE INDEX "DiscoverImportRecord_runId_validationResult_idx" ON "DiscoverImportRecord"("runId", "validationResult");
CREATE INDEX "DiscoverImportRecord_source_sourceRecordId_idx" ON "DiscoverImportRecord"("source", "sourceRecordId");
CREATE UNIQUE INDEX "DiscoverSavedItem_userId_targetType_targetId_key" ON "DiscoverSavedItem"("userId", "targetType", "targetId");
CREATE INDEX "DiscoverSavedItem_userId_createdAt_idx" ON "DiscoverSavedItem"("userId", "createdAt");
CREATE UNIQUE INDEX "DiscoverApplication_opportunityId_userId_key" ON "DiscoverApplication"("opportunityId", "userId");
CREATE INDEX "DiscoverApplication_opportunityId_status_submittedAt_idx" ON "DiscoverApplication"("opportunityId", "status", "submittedAt");
CREATE INDEX "DiscoverApplication_userId_status_submittedAt_idx" ON "DiscoverApplication"("userId", "status", "submittedAt");
CREATE INDEX "DiscoverProviderSelection_opportunityId_status_createdAt_idx" ON "DiscoverProviderSelection"("opportunityId", "status", "createdAt");
CREATE INDEX "DiscoverProviderSelection_providerId_status_idx" ON "DiscoverProviderSelection"("providerId", "status");
CREATE INDEX "DiscoverOpportunityActivity_opportunityId_occurredAt_idx" ON "DiscoverOpportunityActivity"("opportunityId", "occurredAt");

-- All access is through server-side APIs. Keep Data API access closed by
-- default and use RLS as defence in depth.
ALTER TABLE "DiscoverOpportunity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiscoverImportRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiscoverImportRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiscoverSavedItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiscoverApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiscoverProviderSelection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiscoverOpportunityActivity" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "DiscoverOpportunity" FROM anon, authenticated;
REVOKE ALL ON TABLE "DiscoverImportRun" FROM anon, authenticated;
REVOKE ALL ON TABLE "DiscoverImportRecord" FROM anon, authenticated;
REVOKE ALL ON TABLE "DiscoverSavedItem" FROM anon, authenticated;
REVOKE ALL ON TABLE "DiscoverApplication" FROM anon, authenticated;
REVOKE ALL ON TABLE "DiscoverProviderSelection" FROM anon, authenticated;
REVOKE ALL ON TABLE "DiscoverOpportunityActivity" FROM anon, authenticated;
