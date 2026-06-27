-- Mission OS: persistent missions, ecosystems, knowledge, timeline

CREATE TABLE "ResolveEcosystem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'organization',
    "keywordsJson" TEXT NOT NULL DEFAULT '[]',
    "reposJson" TEXT NOT NULL DEFAULT '[]',
    "connectorsJson" TEXT NOT NULL DEFAULT '[]',
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolveEcosystem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResolveMission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "capability" TEXT,
    "phase" TEXT,
    "ecosystemId" TEXT,
    "findingCount" INTEGER NOT NULL DEFAULT 0,
    "capitalUsd" DOUBLE PRECISION,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolveMission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResolveMissionTurn" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "phase" TEXT,
    "capability" TEXT,
    "findingsJson" TEXT,
    "actionsJson" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolveMissionTurn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResolveKnowledgeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'mission',
    "summary" TEXT NOT NULL,
    "contentJson" TEXT,
    "source" TEXT,
    "ecosystemId" TEXT,
    "missionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolveKnowledgeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResolveTimelineEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ecosystemId" TEXT,
    "missionId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolveTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResolveEcosystem_userId_name_key" ON "ResolveEcosystem"("userId", "name");
CREATE INDEX "ResolveEcosystem_userId_idx" ON "ResolveEcosystem"("userId");
CREATE INDEX "ResolveMission_userId_updatedAt_idx" ON "ResolveMission"("userId", "updatedAt");
CREATE INDEX "ResolveMission_ecosystemId_idx" ON "ResolveMission"("ecosystemId");
CREATE INDEX "ResolveMission_status_idx" ON "ResolveMission"("status");
CREATE INDEX "ResolveMissionTurn_missionId_sortOrder_idx" ON "ResolveMissionTurn"("missionId", "sortOrder");
CREATE INDEX "ResolveKnowledgeEntry_userId_updatedAt_idx" ON "ResolveKnowledgeEntry"("userId", "updatedAt");
CREATE INDEX "ResolveKnowledgeEntry_ecosystemId_idx" ON "ResolveKnowledgeEntry"("ecosystemId");
CREATE INDEX "ResolveTimelineEvent_userId_createdAt_idx" ON "ResolveTimelineEvent"("userId", "createdAt");
CREATE INDEX "ResolveTimelineEvent_ecosystemId_createdAt_idx" ON "ResolveTimelineEvent"("ecosystemId", "createdAt");
CREATE INDEX "ResolveTimelineEvent_missionId_idx" ON "ResolveTimelineEvent"("missionId");

ALTER TABLE "ResolveEcosystem" ADD CONSTRAINT "ResolveEcosystem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResolveMission" ADD CONSTRAINT "ResolveMission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResolveMission" ADD CONSTRAINT "ResolveMission_ecosystemId_fkey" FOREIGN KEY ("ecosystemId") REFERENCES "ResolveEcosystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResolveMissionTurn" ADD CONSTRAINT "ResolveMissionTurn_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "ResolveMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResolveKnowledgeEntry" ADD CONSTRAINT "ResolveKnowledgeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResolveKnowledgeEntry" ADD CONSTRAINT "ResolveKnowledgeEntry_ecosystemId_fkey" FOREIGN KEY ("ecosystemId") REFERENCES "ResolveEcosystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResolveKnowledgeEntry" ADD CONSTRAINT "ResolveKnowledgeEntry_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "ResolveMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResolveTimelineEvent" ADD CONSTRAINT "ResolveTimelineEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResolveTimelineEvent" ADD CONSTRAINT "ResolveTimelineEvent_ecosystemId_fkey" FOREIGN KEY ("ecosystemId") REFERENCES "ResolveEcosystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResolveTimelineEvent" ADD CONSTRAINT "ResolveTimelineEvent_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "ResolveMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
