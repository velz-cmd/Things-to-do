-- Per-user Gmail OAuth refresh token for Radar discovery
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gmailRefreshToken" TEXT;
