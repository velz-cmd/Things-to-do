-- CreateTable
CREATE TABLE "ResolveAutomationRule" (
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

-- CreateIndex
CREATE INDEX "ResolveAutomationRule_installId_idx" ON "ResolveAutomationRule"("installId");

-- CreateIndex
CREATE INDEX "ResolveAutomationRule_userId_idx" ON "ResolveAutomationRule"("userId");

-- CreateIndex
CREATE INDEX "ResolveAutomationRule_communitySlug_idx" ON "ResolveAutomationRule"("communitySlug");

-- CreateIndex
CREATE INDEX "ResolveAutomationRule_enabled_idx" ON "ResolveAutomationRule"("enabled");

-- AddForeignKey
ALTER TABLE "ResolveAutomationRule" ADD CONSTRAINT "ResolveAutomationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolveAutomationRule" ADD CONSTRAINT "ResolveAutomationRule_installId_fkey" FOREIGN KEY ("installId") REFERENCES "ResolveCommunityInstall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolveAutomationRule" ADD CONSTRAINT "ResolveAutomationRule_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ResolveProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
