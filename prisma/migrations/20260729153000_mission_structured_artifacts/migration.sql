-- Persist versioned Mission artifacts behind the owning Mission session.
CREATE TABLE "ResolveMissionArtifact" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "operationId" TEXT,
    "sourceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolveMissionArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResolveMissionArtifact_missionId_kind_version_key"
ON "ResolveMissionArtifact"("missionId", "kind", "version");

CREATE INDEX "ResolveMissionArtifact_missionId_createdAt_idx"
ON "ResolveMissionArtifact"("missionId", "createdAt");

CREATE INDEX "ResolveMissionArtifact_kind_status_idx"
ON "ResolveMissionArtifact"("kind", "status");

CREATE INDEX "ResolveMissionArtifact_operationId_idx"
ON "ResolveMissionArtifact"("operationId");

ALTER TABLE "ResolveMissionArtifact"
ADD CONSTRAINT "ResolveMissionArtifact_missionId_fkey"
FOREIGN KEY ("missionId") REFERENCES "ResolveMission"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResolveMissionArtifact" ENABLE ROW LEVEL SECURITY;
