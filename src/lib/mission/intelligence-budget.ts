import "server-only";

import { prisma } from "@/lib/db";
import { ensureMissionBudgetSchema } from "@/lib/db/ensure-mission-budget-schema";

/**
 * Durable accounting for a Mission's intelligence (evidence) budget.
 *
 * The previous budget lived in localStorage, so it vanished when the browser
 * closed, could not bound a server-side run, and two tabs could each believe
 * the full budget was available. Money authority cannot live in a browser.
 *
 * All arithmetic is in integer micro-USD. Floating point must never decide
 * whether a spend is within authority: 0.1 + 0.2 !== 0.3 is not an acceptable
 * basis for authorising a payment.
 */

export const MICRO = 1_000_000;

export function usdToMicro(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new Error("Budget amounts must be finite and non-negative");
  }
  // Round rather than truncate so 0.003 USDC is 3000 micro, not 2999.
  return Math.round(usd * MICRO);
}

export function microToUsd(micro: number): number {
  return micro / MICRO;
}

/** A spend is only released from the budget when it can no longer settle. */
export type SpendState =
  | "reserved"
  | "submitted"
  | "confirmed"
  | "released"
  | "failed";

/** States that still hold budget. Released and failed do not. */
const HOLDING_STATES: ReadonlySet<SpendState> = new Set([
  "reserved",
  "submitted",
  "confirmed",
]);

export type SpendEntry = {
  amountMicro: number;
  state: SpendState;
};

export type BudgetState = {
  grantedMicro: number;
  perPurchaseLimitMicro: number;
  /** Authorised but not yet submitted. */
  reservedMicro: number;
  /** Submitted on chain, outcome not yet authoritative. */
  submittedMicro: number;
  /** Authoritatively settled. */
  confirmedMicro: number;
  /** Everything still holding budget. */
  committedMicro: number;
  availableMicro: number;
};

/**
 * Derives budget state from the canonical ledger entries.
 *
 * Deliberately NOT "granted minus what the UI thinks it spent": a submitted
 * payment whose confirmation has not arrived still holds budget, otherwise a
 * second purchase could be authorised against money already in flight.
 */
export function computeBudgetState(input: {
  grantedMicro: number;
  perPurchaseLimitMicro: number;
  entries: readonly SpendEntry[];
}): BudgetState {
  let reservedMicro = 0;
  let submittedMicro = 0;
  let confirmedMicro = 0;

  for (const entry of input.entries) {
    if (!HOLDING_STATES.has(entry.state)) continue;
    if (entry.state === "reserved") reservedMicro += entry.amountMicro;
    else if (entry.state === "submitted") submittedMicro += entry.amountMicro;
    else confirmedMicro += entry.amountMicro;
  }

  const committedMicro = reservedMicro + submittedMicro + confirmedMicro;
  return {
    grantedMicro: input.grantedMicro,
    perPurchaseLimitMicro: input.perPurchaseLimitMicro,
    reservedMicro,
    submittedMicro,
    confirmedMicro,
    committedMicro,
    availableMicro: Math.max(0, input.grantedMicro - committedMicro),
  };
}

export type SpendRefusal =
  | { ok: true }
  | { ok: false; code: "exceeds_per_purchase"; reason: string }
  | { ok: false; code: "exceeds_budget"; reason: string }
  | { ok: false; code: "invalid_amount"; reason: string };

/**
 * Whether one purchase is within authority. Reasons are written for a person:
 * "the 0.50 USDC intelligence budget is exhausted", not an enum.
 */
export function checkSpendAuthority(input: {
  amountMicro: number;
  state: BudgetState;
}): SpendRefusal {
  const { amountMicro, state } = input;
  if (!Number.isInteger(amountMicro) || amountMicro <= 0) {
    return {
      ok: false,
      code: "invalid_amount",
      reason: "The purchase amount must be a positive USDC value.",
    };
  }
  if (amountMicro > state.perPurchaseLimitMicro) {
    return {
      ok: false,
      code: "exceeds_per_purchase",
      reason: `This costs ${formatUsdc(amountMicro)} but the per-purchase limit is ${formatUsdc(state.perPurchaseLimitMicro)}.`,
    };
  }
  if (amountMicro > state.availableMicro) {
    return {
      ok: false,
      code: "exceeds_budget",
      reason: `This costs ${formatUsdc(amountMicro)} but only ${formatUsdc(state.availableMicro)} of the ${formatUsdc(state.grantedMicro)} intelligence budget remains.`,
    };
  }
  return { ok: true };
}

/** Sub-cent amounts keep precision; a real charge never displays as 0. */
export function formatUsdc(micro: number): string {
  const usd = microToUsd(micro);
  const magnitude = Math.abs(usd);
  const digits = usd !== 0 && magnitude < 0.01 ? 6 : 2;
  return `${usd.toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")} USDC`;
}

export type ReserveResult =
  | { ok: true; spendId: string; state: BudgetState; reused: boolean }
  | { ok: false; code: string; reason: string; state: BudgetState };

/**
 * Reserves budget for one purchase.
 *
 * Idempotent on idempotencyKey: a retry after a dropped connection returns the
 * existing reservation instead of debiting twice. The read-check-write runs in
 * a transaction so two concurrent runs cannot both pass the availability check
 * and jointly overspend.
 */
export async function reserveMissionSpend(input: {
  missionId: string;
  userId: string;
  amountMicro: number;
  idempotencyKey: string;
  serviceId?: string;
  reason?: string;
}): Promise<ReserveResult> {
  await ensureMissionBudgetSchema();

  return prisma.$transaction(async (tx) => {
    const budgetRow = await tx.missionIntelligenceBudget.findUnique({
      where: { missionId: input.missionId },
      select: { budgetMicro: true, perPurchaseMicro: true },
    });

    const grantedMicro = budgetRow?.budgetMicro ?? 0;
    const perPurchaseLimitMicro = budgetRow?.perPurchaseMicro ?? 0;

    const existing = await tx.missionIntelligenceSpend.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });

    const entries = await tx.missionIntelligenceSpend.findMany({
      where: { missionId: input.missionId },
      select: { amountMicro: true, state: true },
    });
    const state = computeBudgetState({
      grantedMicro,
      perPurchaseLimitMicro,
      entries: entries as SpendEntry[],
    });

    if (existing) {
      return { ok: true, spendId: existing.id, state, reused: true } as const;
    }

    const authority = checkSpendAuthority({
      amountMicro: input.amountMicro,
      state,
    });
    if (!authority.ok) {
      return {
        ok: false,
        code: authority.code,
        reason: authority.reason,
        state,
      } as const;
    }

    const created = await tx.missionIntelligenceSpend.create({
      data: {
        missionId: input.missionId,
        userId: input.userId,
        amountMicro: input.amountMicro,
        state: "reserved",
        idempotencyKey: input.idempotencyKey,
        serviceId: input.serviceId ?? null,
        reason: input.reason ?? null,
      },
      select: { id: true },
    });

    return {
      ok: true,
      spendId: created.id,
      state: computeBudgetState({
        grantedMicro,
        perPurchaseLimitMicro,
        entries: [
          ...(entries as SpendEntry[]),
          { amountMicro: input.amountMicro, state: "reserved" },
        ],
      }),
      reused: false,
    } as const;
  });
}

/**
 * Advances a reservation. Payment and execution are separate: a payment can
 * confirm while the agent execution fails, so "confirmed" here means the money
 * settled, never that the result is usable evidence.
 */
export async function settleMissionSpend(input: {
  spendId: string;
  state: Extract<SpendState, "submitted" | "confirmed" | "released" | "failed">;
  txHash?: string;
  paymentRef?: string;
}): Promise<void> {
  await ensureMissionBudgetSchema();
  await prisma.missionIntelligenceSpend.update({
    where: { id: input.spendId },
    data: {
      state: input.state,
      txHash: input.txHash ?? undefined,
      paymentRef: input.paymentRef ?? undefined,
    },
  });
}

/** Canonical budget state for a Mission, for display and for authority checks. */
export async function missionBudgetState(
  missionId: string,
): Promise<BudgetState> {
  const available = await ensureMissionBudgetSchema();
  if (!available) {
    return computeBudgetState({
      grantedMicro: 0,
      perPurchaseLimitMicro: 0,
      entries: [],
    });
  }
  const [budgetRow, entries] = await Promise.all([
    prisma.missionIntelligenceBudget.findUnique({
      where: { missionId },
      select: { budgetMicro: true, perPurchaseMicro: true },
    }),
    prisma.missionIntelligenceSpend.findMany({
      where: { missionId },
      select: { amountMicro: true, state: true },
    }),
  ]);
  return computeBudgetState({
    grantedMicro: budgetRow?.budgetMicro ?? 0,
    perPurchaseLimitMicro: budgetRow?.perPurchaseMicro ?? 0,
    entries: entries as SpendEntry[],
  });
}
