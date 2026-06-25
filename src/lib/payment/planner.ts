import type { MissionSettlementInput, PaymentIntent } from "@/lib/payment/types";
import { reserveCapitalPools } from "@/lib/payment/pools";

export interface SettlementPlanResult {
  pools: ReturnType<typeof reserveCapitalPools>;
  intents: PaymentIntent[];
  contributorTotal: number;
}

/**
 * Settlement Planner — NEVER scores. Only converts verified weights → USDC amounts.
 */
export function buildSettlementPlan(input: {
  settlementId: string;
  package: MissionSettlementInput;
}): SettlementPlanResult {
  const pools = reserveCapitalPools(input.package.treasuryAmount);

  const sorted = [...input.package.contributors].sort(
    (a, b) => Number(b.amount) - Number(a.amount),
  );

  const intents: PaymentIntent[] = sorted.map((c, idx) => ({
    id: `${input.settlementId}:intent:${c.wallet.toLowerCase()}`,
    wallet: c.wallet,
    login: c.login,
    weight: c.weight,
    amountUsd: Number(c.amount),
    rank: idx + 1,
    status: "pending",
  }));

  const contributorTotal = intents.reduce((s, i) => s + i.amountUsd, 0);

  return { pools, intents, contributorTotal };
}
