import { prisma } from "@/lib/db";
import { runDdlOnDirectConnection } from "@/lib/db/direct-postgres";
import { isMissingTableError } from "@/lib/db/prisma-errors";

let ensured = false;
let ensurePromise: Promise<boolean> | null = null;

const PASSWORD_RESET_DDL = `
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key"
  ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx"
  ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_email_idx"
  ON "PasswordResetToken"("email");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx"
  ON "PasswordResetToken"("expiresAt");
`;

async function verifyResetTableExists(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "PasswordResetToken" LIMIT 1`;
    return true;
  } catch (e) {
    return isMissingTableError(e) ? false : false;
  }
}

/**
 * Idempotent — creates PasswordResetToken if migrations were not applied yet.
 * Uses DIRECT_URL for DDL when available (transaction pooler cannot run CREATE TABLE).
 */
export async function ensurePasswordResetSchema(): Promise<boolean> {
  if (ensured) return true;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      if (await verifyResetTableExists()) {
        ensured = true;
        return true;
      }

      const directOk = await runDdlOnDirectConnection(PASSWORD_RESET_DDL);
      if (!directOk) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "tokenHash" TEXT NOT NULL,
            "expiresAt" TIMESTAMP(3) NOT NULL,
            "usedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
          );
        `);
        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key"
          ON "PasswordResetToken"("tokenHash");
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx"
          ON "PasswordResetToken"("userId");
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "PasswordResetToken_email_idx"
          ON "PasswordResetToken"("email");
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx"
          ON "PasswordResetToken"("expiresAt");
        `);
      }

      if (await verifyResetTableExists()) {
        ensured = true;
        return true;
      }

      return false;
    } catch (e) {
      if (!isMissingTableError(e)) {
        console.error("[auth] ensurePasswordResetSchema failed:", e);
      }
      return false;
    } finally {
      ensurePromise = null;
    }
  })();

  return ensurePromise;
}
