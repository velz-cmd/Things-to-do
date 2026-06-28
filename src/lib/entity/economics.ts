/**
 * Entity economics — conservation flow, Gini, h-index style metrics.
 * All inputs come from ledger facts; empty states are explicit.
 */

export type ConservationFlow = {
  inflowsUsd: number;
  treasuryUsd: number;
  settledUsd: number;
  pendingUsd: number;
  balanced: boolean;
  residualUsd: number;
  evidence: string;
};

export type GiniResult = {
  coefficient: number;
  evidence: string;
};

export type HIndexResult = {
  hIndex: number;
  topWeights: number[];
  evidence: string;
};

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** ∑ inflows = treasury + settled + pending — money does not appear from nowhere. */
export function conservationFlow(input: {
  inflowsUsd: number;
  treasuryUsd: number;
  settledUsd: number;
  pendingUsd: number;
}): ConservationFlow {
  const { inflowsUsd, treasuryUsd, settledUsd, pendingUsd } = input;
  const rhs = treasuryUsd + settledUsd + pendingUsd;
  const residual = round(inflowsUsd - rhs);
  const balanced = Math.abs(residual) < 0.02;

  return {
    inflowsUsd: round(inflowsUsd),
    treasuryUsd: round(treasuryUsd),
    settledUsd: round(settledUsd),
    pendingUsd: round(pendingUsd),
    balanced,
    residualUsd: residual,
    evidence: balanced
      ? `∑ inflows ($${inflowsUsd.toFixed(2)}) = treasury ($${treasuryUsd.toFixed(2)}) + settled ($${settledUsd.toFixed(2)}) + pending ($${pendingUsd.toFixed(2)})`
      : `Conservation residual $${residual.toFixed(2)} — treasury snapshot and entity ledger slice may use different scopes.`,
  };
}

/**
 * Gini coefficient on payment shares.
 * G = (Σ_i Σ_j |x_i - x_j|) / (2n Σ x_i)
 */
export function giniCoefficient(amounts: number[]): GiniResult {
  const values = amounts.filter((a) => a > 0).sort((a, b) => a - b);
  const n = values.length;

  if (n === 0) {
    return {
      coefficient: 0,
      evidence: "No payment distribution yet — Gini undefined until ledger rows exist.",
    };
  }
  if (n === 1) {
    return {
      coefficient: 0,
      evidence: "Single payee in slice — Gini = 0 by definition.",
    };
  }

  const total = values.reduce((s, v) => s + v, 0);
  let sumDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumDiff += Math.abs(values[i] - values[j]);
    }
  }
  const g = sumDiff / (2 * n * total);
  const coefficient = Math.round(g * 1000) / 1000;

  return {
    coefficient,
    evidence:
      coefficient >= 0.6
        ? `G = ${coefficient.toFixed(2)} — high inequality across ${n} payees in this entity slice.`
        : `G = ${coefficient.toFixed(2)} across ${n} payees from ledger amounts.`,
  };
}

/** H-index style: largest h where h works each have ≥ h weighted recognition units. */
export function hIndexStyle(weights: number[]): HIndexResult {
  const sorted = weights.filter((w) => w > 0).sort((a, b) => b - a);
  if (!sorted.length) {
    return {
      hIndex: 0,
      topWeights: [],
      evidence: "No weighted contributions yet — h-index undefined.",
    };
  }

  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }

  return {
    hIndex: h,
    topWeights: sorted.slice(0, 10),
    evidence: `h = ${h} — ${h} works each have ≥ ${h} weighted recognition units (from ledger, not OpenAlex).`,
  };
}
