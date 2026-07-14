CREATE TABLE "CreatorAsset" (
  "id" TEXT PRIMARY KEY, "ownerUserId" TEXT NOT NULL, "type" TEXT NOT NULL,
  "canonicalUrl" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "sourceAdapterId" TEXT NOT NULL, "externalId" TEXT, "ownershipState" TEXT NOT NULL DEFAULT 'unverified',
  "ownershipChallenge" TEXT, "ownershipProof" JSONB, "ownershipVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CreatorAsset_ownerUserId_canonicalUrl_key" ON "CreatorAsset"("ownerUserId", "canonicalUrl");
CREATE INDEX "CreatorAsset_ownerUserId_ownershipState_idx" ON "CreatorAsset"("ownerUserId", "ownershipState");

CREATE TABLE "OutcomeCampaign" (
  "id" TEXT PRIMARY KEY, "creatorUserId" TEXT NOT NULL, "assetId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "objective" TEXT NOT NULL, "contributionType" TEXT NOT NULL, "verificationAdapterId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft', "totalBudgetMicroUsdc" BIGINT NOT NULL,
  "committedMicroUsdc" BIGINT NOT NULL DEFAULT 0, "recognizedMicroUsdc" BIGINT NOT NULL DEFAULT 0,
  "settledMicroUsdc" BIGINT NOT NULL DEFAULT 0, "participantCapMicroUsdc" BIGINT,
  "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3), "activePolicyVersionId" TEXT,
  "fundingIntentId" TEXT, "blueprintId" TEXT, "simulationId" TEXT,
  "approvedAt" TIMESTAMP(3), "publishedAt" TIMESTAMP(3), "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "OutcomeCampaign_creatorUserId_status_idx" ON "OutcomeCampaign"("creatorUserId", "status");
CREATE INDEX "OutcomeCampaign_status_startsAt_endsAt_idx" ON "OutcomeCampaign"("status", "startsAt", "endsAt");
CREATE INDEX "OutcomeCampaign_assetId_idx" ON "OutcomeCampaign"("assetId");

CREATE TABLE "CampaignParticipant" ("id" TEXT PRIMARY KEY, "campaignId" TEXT NOT NULL, "userId" TEXT NOT NULL, "identityId" TEXT, "status" TEXT NOT NULL DEFAULT 'joined', "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "CampaignParticipant_campaignId_userId_key" ON "CampaignParticipant"("campaignId", "userId");
CREATE INDEX "CampaignParticipant_userId_status_idx" ON "CampaignParticipant"("userId", "status");

CREATE TABLE "WorkSubmission" ("id" TEXT PRIMARY KEY, "campaignId" TEXT NOT NULL, "participantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "workUrl" TEXT NOT NULL, "sourceReference" TEXT, "status" TEXT NOT NULL DEFAULT 'submitted', "latestSnapshotId" TEXT, "latestOutcomeEventId" TEXT, "identityChallenge" TEXT, "identityProof" JSONB, "identityVerifiedAt" TIMESTAMP(3), "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "withdrawnAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "WorkSubmission_campaignId_workUrl_key" ON "WorkSubmission"("campaignId", "workUrl");
CREATE INDEX "WorkSubmission_userId_status_idx" ON "WorkSubmission"("userId", "status");
CREATE INDEX "WorkSubmission_campaignId_status_idx" ON "WorkSubmission"("campaignId", "status");

CREATE TABLE "OutcomeSnapshot" ("id" TEXT PRIMARY KEY, "submissionId" TEXT NOT NULL, "adapterId" TEXT NOT NULL, "sourceObjectId" TEXT NOT NULL, "unitType" TEXT NOT NULL, "value" BIGINT NOT NULL, "contentHash" TEXT NOT NULL, "observedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "OutcomeSnapshot_submissionId_contentHash_key" ON "OutcomeSnapshot"("submissionId", "contentHash");
CREATE INDEX "OutcomeSnapshot_submissionId_observedAt_idx" ON "OutcomeSnapshot"("submissionId", "observedAt");

CREATE TABLE "OutcomeEvent" ("id" TEXT PRIMARY KEY, "adapterId" TEXT NOT NULL, "sourceEventId" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "submissionId" TEXT NOT NULL, "type" TEXT NOT NULL, "actorIdentityId" TEXT, "objectUrl" TEXT NOT NULL, "objectLabel" TEXT NOT NULL, "unitType" TEXT NOT NULL, "unitValue" BIGINT NOT NULL, "baselineValue" BIGINT, "currentValue" BIGINT, "incrementalValue" BIGINT, "evidenceState" TEXT NOT NULL, "recognitionState" TEXT NOT NULL DEFAULT 'unreviewed', "contentHash" TEXT NOT NULL, "observedAt" TIMESTAMP(3) NOT NULL, "synchronizedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "OutcomeEvent_adapterId_sourceEventId_key" ON "OutcomeEvent"("adapterId", "sourceEventId");
CREATE INDEX "OutcomeEvent_campaignId_recognitionState_idx" ON "OutcomeEvent"("campaignId", "recognitionState");
CREATE INDEX "OutcomeEvent_submissionId_observedAt_idx" ON "OutcomeEvent"("submissionId", "observedAt");

CREATE TABLE "OutcomeEvidence" ("id" TEXT PRIMARY KEY, "outcomeEventId" TEXT NOT NULL, "evidenceId" TEXT, "provider" TEXT NOT NULL, "sourceUrl" TEXT NOT NULL, "state" TEXT NOT NULL, "payload" JSONB NOT NULL, "contentHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "OutcomeEvidence_outcomeEventId_contentHash_key" ON "OutcomeEvidence"("outcomeEventId", "contentHash");
CREATE INDEX "OutcomeEvidence_outcomeEventId_state_idx" ON "OutcomeEvidence"("outcomeEventId", "state");

CREATE TABLE "RecognitionPolicyVersion" ("id" TEXT PRIMARY KEY, "campaignId" TEXT NOT NULL, "version" INTEGER NOT NULL, "formula" JSONB NOT NULL, "evidenceRequirements" JSONB NOT NULL, "identityRequirements" JSONB NOT NULL, "reviewDelaySeconds" INTEGER NOT NULL, "participantCapMicroUsdc" BIGINT, "campaignCapMicroUsdc" BIGINT NOT NULL, "contentHash" TEXT NOT NULL, "activeFrom" TIMESTAMP(3) NOT NULL, "supersededAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "RecognitionPolicyVersion_campaignId_version_key" ON "RecognitionPolicyVersion"("campaignId", "version");
CREATE INDEX "RecognitionPolicyVersion_campaignId_activeFrom_idx" ON "RecognitionPolicyVersion"("campaignId", "activeFrom");
CREATE INDEX "RecognitionPolicyVersion_contentHash_idx" ON "RecognitionPolicyVersion"("contentHash");

CREATE TABLE "EarningsLedgerEntry" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "submissionId" TEXT, "obligationId" TEXT, "receiptId" TEXT, "type" TEXT NOT NULL, "state" TEXT NOT NULL, "amountMicroUsdc" BIGINT NOT NULL, "referenceHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "EarningsLedgerEntry_referenceHash_key" ON "EarningsLedgerEntry"("referenceHash");
CREATE INDEX "EarningsLedgerEntry_userId_state_createdAt_idx" ON "EarningsLedgerEntry"("userId", "state", "createdAt");
CREATE INDEX "EarningsLedgerEntry_campaignId_createdAt_idx" ON "EarningsLedgerEntry"("campaignId", "createdAt");

CREATE TABLE "CampaignFundingRequirement" ("id" TEXT PRIMARY KEY, "campaignId" TEXT NOT NULL, "fundingIntentId" TEXT, "amountMicroUsdc" BIGINT NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft', "contentHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "CampaignFundingRequirement_campaignId_key" ON "CampaignFundingRequirement"("campaignId");
CREATE UNIQUE INDEX "CampaignFundingRequirement_contentHash_key" ON "CampaignFundingRequirement"("contentHash");

CREATE TABLE "FraudReview" ("id" TEXT PRIMARY KEY, "submissionId" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'not_required', "reasons" JSONB NOT NULL, "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "FraudReview_submissionId_key" ON "FraudReview"("submissionId");
CREATE INDEX "FraudReview_state_createdAt_idx" ON "FraudReview"("state", "createdAt");

CREATE TABLE "ActionRun" ("id" TEXT PRIMARY KEY, "userId" TEXT, "actionId" TEXT NOT NULL, "aggregateType" TEXT NOT NULL, "aggregateId" TEXT, "idempotencyKey" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'validating', "recommendationReason" TEXT NOT NULL, "input" JSONB NOT NULL, "output" JSONB, "errorCode" TEXT, "errorMessage" TEXT, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3));
CREATE UNIQUE INDEX "ActionRun_idempotencyKey_key" ON "ActionRun"("idempotencyKey");
CREATE INDEX "ActionRun_userId_startedAt_idx" ON "ActionRun"("userId", "startedAt");
CREATE INDEX "ActionRun_aggregateType_aggregateId_startedAt_idx" ON "ActionRun"("aggregateType", "aggregateId", "startedAt");
CREATE INDEX "ActionRun_actionId_state_idx" ON "ActionRun"("actionId", "state");

DO $$ DECLARE table_name TEXT; BEGIN
  FOREACH table_name IN ARRAY ARRAY['CreatorAsset','OutcomeCampaign','CampaignParticipant','WorkSubmission','OutcomeSnapshot','OutcomeEvent','OutcomeEvidence','RecognitionPolicyVersion','EarningsLedgerEntry','CampaignFundingRequirement','FraudReview','ActionRun'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM anon, authenticated', table_name);
  END LOOP;
END $$;
