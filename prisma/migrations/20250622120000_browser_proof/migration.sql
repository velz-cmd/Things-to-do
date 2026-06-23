-- CreateTable
CREATE TABLE IF NOT EXISTS "BrowserProof" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "path" TEXT,
    "text" TEXT,
    "artifactData" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BrowserProof_taskId_idx" ON "BrowserProof"("taskId");

ALTER TABLE "BrowserProof" ADD CONSTRAINT "BrowserProof_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
