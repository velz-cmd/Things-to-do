-- CreateTable
CREATE TABLE "ResolveCommunityInstall" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communitySlug" TEXT NOT NULL,
    "ecosystemId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "connectorIdsJson" TEXT NOT NULL DEFAULT '[]',
    "doctrineJson" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolveCommunityInstall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolveProgram" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL DEFAULT 'user-centric-royalties',
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "budgetUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rulesJson" TEXT NOT NULL DEFAULT '{}',
    "recipientsJson" TEXT NOT NULL DEFAULT '[]',
    "missionId" TEXT,
    "lastDeployAt" TIMESTAMP(3),
    "lastSettlementId" TEXT,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolveProgram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResolveCommunityInstall_communitySlug_idx" ON "ResolveCommunityInstall"("communitySlug");

-- CreateIndex
CREATE INDEX "ResolveCommunityInstall_userId_idx" ON "ResolveCommunityInstall"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ResolveCommunityInstall_userId_communitySlug_key" ON "ResolveCommunityInstall"("userId", "communitySlug");

-- CreateIndex
CREATE INDEX "ResolveProgram_userId_idx" ON "ResolveProgram"("userId");

-- CreateIndex
CREATE INDEX "ResolveProgram_installId_idx" ON "ResolveProgram"("installId");

-- CreateIndex
CREATE INDEX "ResolveProgram_missionId_idx" ON "ResolveProgram"("missionId");

-- CreateIndex
CREATE INDEX "ResolveProgram_status_idx" ON "ResolveProgram"("status");

-- AddForeignKey
ALTER TABLE "ResolveCommunityInstall" ADD CONSTRAINT "ResolveCommunityInstall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolveCommunityInstall" ADD CONSTRAINT "ResolveCommunityInstall_ecosystemId_fkey" FOREIGN KEY ("ecosystemId") REFERENCES "ResolveEcosystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolveProgram" ADD CONSTRAINT "ResolveProgram_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolveProgram" ADD CONSTRAINT "ResolveProgram_installId_fkey" FOREIGN KEY ("installId") REFERENCES "ResolveCommunityInstall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
