import { prisma } from "@/lib/db";
import { isMissingTableError } from "@/lib/db/prisma-errors";

let ensured = false;
let ensurePromise: Promise<boolean> | null = null;

/**
 * Idempotent — creates PasswordResetToken if migrations were not applied yet.
 * Vercel builds only run `prisma generate`; this heals production on first auth use.
 */
export async function ensurePasswordResetSchema(): Promise<boolean> {
  if (ensured) return true;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
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
      ensured = true;
      return true;
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
