-- Per-user community identity connections (ListenBrainz, Navidrome)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "listenbrainzUsername" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "listenbrainzToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "navidromeUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "navidromeUsername" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "navidromePassword" TEXT;
