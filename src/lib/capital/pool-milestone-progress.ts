/** Primary pool milestone ladder shown on Discover + Communities (USD). */
export const PRIMARY_POOL_MILESTONES_USD = [500, 2500, 5000, 10000, 25000] as const;

export type PoolMilestoneSegment = {
  floorUsd: number;
  ceilingUsd: number;
  poolUsd: number;
  progressPct: number;
  labelUsd: number;
};

function roundPct(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Progress within the active milestone segment — e.g. $0→$500, then $500→$2500. */
export function computePoolMilestoneSegment(
  poolUsd: number,
  milestones: readonly number[] = PRIMARY_POOL_MILESTONES_USD,
): PoolMilestoneSegment {
  const pool = Math.max(0, poolUsd);
  const sorted = [...milestones].filter((n) => n > 0).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return {
      floorUsd: 0,
      ceilingUsd: 500,
      poolUsd: pool,
      progressPct: roundPct((pool / 500) * 100),
      labelUsd: pool,
    };
  }

  let floor = 0;
  for (const ceiling of sorted) {
    if (pool < ceiling) {
      const span = ceiling - floor;
      return {
        floorUsd: floor,
        ceilingUsd: ceiling,
        poolUsd: pool,
        progressPct: span > 0 ? roundPct(((pool - floor) / span) * 100) : 100,
        labelUsd: pool,
      };
    }
    floor = ceiling;
  }

  const last = sorted[sorted.length - 1]!;
  return {
    floorUsd: last,
    ceilingUsd: last,
    poolUsd: pool,
    progressPct: 100,
    labelUsd: pool,
  };
}

export function formatMilestoneUsd(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return Number.isInteger(k) ? `$${k}k` : `$${k.toFixed(1)}k`;
  }
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
