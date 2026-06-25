import type { CapitalPools } from "@/lib/payment/types";

/** Internal capital reservation — nothing moves on-chain yet */
export function reserveCapitalPools(treasuryAmount: number): CapitalPools {
  return {
    mission: Math.round(treasuryAmount * 0.7 * 100) / 100,
    bonus: Math.round(treasuryAmount * 0.2 * 100) / 100,
    emergency: Math.round(treasuryAmount * 0.1 * 100) / 100,
  };
}

export function poolHeadline(pools: CapitalPools): string {
  return `Mission $${pools.mission} · Bonus $${pools.bonus} · Emergency $${pools.emergency}`;
}
