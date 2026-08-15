import { prisma } from "@/lib/db";
import { runDdlOnDirectConnection } from "@/lib/db/direct-postgres";

let ensured = false;
let ensurePromise: Promise<boolean> | null = null;

/**
 * Adds on-chain provenance to community fund stakes.
 *
 * Without these columns a stake records only that money was promised, never
 * that it settled, so a confirmed Arc deposit could not be told apart from an
 * unverifiable commitment - which is why Pool capital displayed as
 * "recorded as committed" even after four confirmed transfers.
 *
 * Additive and nullable, so existing rows keep working: an older stake with
 * no hash is treated as committed-but-unproven, which is exactly what it is.
 */
const FUND_STAKE_ARC_DDL = `
ALTER TABLE "CommunityFundStake"
  ADD COLUMN IF NOT EXISTS "arcTxHash" TEXT;
ALTER TABLE "CommunityFundStake"
  ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "CommunityFundStake_arcTxHash_idx"
  ON "CommunityFundStake"("arcTxHash");
`;

async function columnsExist(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT "arcTxHash", "confirmedAt" FROM "CommunityFundStake" LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Idempotent. Safe to call on every funding attempt. */
export async function ensureFundStakeArcSchema(): Promise<boolean> {
  if (ensured) return true;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      if (await columnsExist()) {
        ensured = true;
        return true;
      }

      const directOk = await runDdlOnDirectConnection(FUND_STAKE_ARC_DDL);
      if (!directOk) {
        // The transaction pooler cannot run every DDL form, but ADD COLUMN
        // IF NOT EXISTS is cheap enough to retry statement by statement.
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "CommunityFundStake" ADD COLUMN IF NOT EXISTS "arcTxHash" TEXT;`,
        );
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "CommunityFundStake" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);`,
        );
        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "CommunityFundStake_arcTxHash_idx" ON "CommunityFundStake"("arcTxHash");`,
        );
      }

      ensured = await columnsExist();
      return ensured;
    } catch (error) {
      console.error("[ensureFundStakeArcSchema] failed", error);
      return false;
    } finally {
      ensurePromise = null;
    }
  })();

  return ensurePromise;
}
