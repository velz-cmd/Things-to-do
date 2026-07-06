-- Store Blueprint / agent-signal turn payloads for session restore
ALTER TABLE "ResolveMissionTurn" ADD COLUMN IF NOT EXISTS "payloadJson" TEXT;
