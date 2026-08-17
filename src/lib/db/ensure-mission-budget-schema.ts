import { prisma } from "@/lib/db";
import { runDdlOnDirectConnection } from "@/lib/db/direct-postgres";

let ensured = false;
let ensurePromise: Promise<boolean> | null = null;

/**
 * Durable Mission intelligence budget.
 *
 * The build never runs migrations (see scripts/vercel-build.sh), so schema is
 * applied at runtime through this repo's existing healing convention. DDL is
 * deliberately kept out of any request that moves money - an ALTER TABLE
 * inside a payment path previously turned settled transfers into 500s.
 *
 * Budget state lives in its own table, not columns on ResolveMission. That
 * model is read by nearly every Mission code path via unselected
 * findFirst/findMany, and Prisma includes new scalar columns in the default
 * select - adding budget columns directly to ResolveMission broke Mission
 * detail reads (getMission -> getStructuredMission, used by both the mission
 * detail route and runStructuredMissionOperation) until the schema healed,
 * because nothing on that read path called this healer first. Isolating
 * budget state in its own table means only budget-aware code ever touches
 * it, so this class of bug cannot recur.
 */
const MISSION_BUDGET_DDL = `
CREATE TABLE IF NOT EXISTS "MissionIntelligenceBudget" (
  "missionId" TEXT NOT NULL,
  "budgetMicro" INTEGER NOT NULL DEFAULT 0,
  "perPurchaseMicro" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionIntelligenceBudget_pkey" PRIMARY KEY ("missionId")
);
CREATE TABLE IF NOT EXISTS "MissionIntelligenceSpend" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amountMicro" INTEGER NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'reserved',
  "idempotencyKey" TEXT NOT NULL,
  "serviceId" TEXT,
  "reason" TEXT,
  "txHash" TEXT,
  "paymentRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionIntelligenceSpend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MissionIntelligenceSpend_idempotencyKey_key"
  ON "MissionIntelligenceSpend"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "MissionIntelligenceSpend_missionId_idx"
  ON "MissionIntelligenceSpend"("missionId");
CREATE INDEX IF NOT EXISTS "MissionIntelligenceSpend_userId_idx"
  ON "MissionIntelligenceSpend"("userId");
`;

async function schemaPresent(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "MissionIntelligenceSpend" LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM "MissionIntelligenceBudget" LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Idempotent. Safe to call repeatedly; never called from a payment path. */
export async function ensureMissionBudgetSchema(): Promise<boolean> {
  if (ensured) return true;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      if (await schemaPresent()) {
        ensured = true;
        return true;
      }
      const directOk = await runDdlOnDirectConnection(MISSION_BUDGET_DDL);
      if (!directOk) {
        for (const statement of MISSION_BUDGET_DDL.split(";\n").filter((s) =>
          s.trim(),
        )) {
          await prisma.$executeRawUnsafe(`${statement};`);
        }
      }
      ensured = await schemaPresent();
      return ensured;
    } catch (error) {
      console.error("[ensureMissionBudgetSchema] failed", error);
      return false;
    } finally {
      ensurePromise = null;
    }
  })();

  return ensurePromise;
}
