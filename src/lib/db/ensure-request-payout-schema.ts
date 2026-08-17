import { prisma } from "@/lib/db";
import { runDdlOnDirectConnection } from "@/lib/db/direct-postgres";

let ensured = false;
let ensurePromise: Promise<boolean> | null = null;

/**
 * Durable second-leg Request settlement.
 *
 * The build never runs migrations (see scripts/vercel-build.sh), so schema is
 * applied at runtime through this repo's existing healing convention. This
 * state lives in its own table rather than on DiscoverOpportunity or
 * SettlementBatch - both are read by unselected findFirst/findMany across the
 * Discover surface, and Prisma implicitly selects new scalar columns, which
 * previously broke Mission detail reads the same way when budget columns
 * were added directly to ResolveMission.
 */
const REQUEST_PAYOUT_DDL = `
CREATE TABLE IF NOT EXISTS "RequestContributorPayout" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "settlementBatchId" TEXT NOT NULL,
  "fromAddress" TEXT NOT NULL,
  "toAddress" TEXT NOT NULL,
  "amountUsdcMicro" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "txHash" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestContributorPayout_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RequestContributorPayout_opportunityId_key"
  ON "RequestContributorPayout"("opportunityId");
CREATE UNIQUE INDEX IF NOT EXISTS "RequestContributorPayout_idempotencyKey_key"
  ON "RequestContributorPayout"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "RequestContributorPayout_status_idx"
  ON "RequestContributorPayout"("status");
`;

async function schemaPresent(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT "status" FROM "RequestContributorPayout" LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Idempotent. Safe to call repeatedly; memoized after first success. */
export async function ensureRequestPayoutSchema(): Promise<boolean> {
  if (ensured) return true;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      if (await schemaPresent()) {
        ensured = true;
        return true;
      }
      const directOk = await runDdlOnDirectConnection(REQUEST_PAYOUT_DDL);
      if (!directOk) {
        for (const statement of REQUEST_PAYOUT_DDL.split(";\n").filter((s) => s.trim())) {
          await prisma.$executeRawUnsafe(`${statement};`);
        }
      }
      ensured = await schemaPresent();
      return ensured;
    } catch (error) {
      console.error("[ensureRequestPayoutSchema] failed", error);
      return false;
    } finally {
      ensurePromise = null;
    }
  })();

  return ensurePromise;
}
