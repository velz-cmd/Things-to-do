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
  /** Kill switch is engaged - no new spend may be reserved regardless of availableMicro. */
  revoked: boolean;
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
  revoked?: boolean;
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
    revoked: input.revoked ?? false,
  };
}

export type SpendRefusal =
  | { ok: true }
  | { ok: false; code: "exceeds_per_purchase"; reason: string }
  | { ok: false; code: "exceeds_budget"; reason: string }
  | { ok: false; code: "invalid_amount"; reason: string }
  | { ok: false; code: "revoked"; reason: string };

/**
 * Whether one purchase is within authority. Reasons are written for a person:
 * "the 0.50 USDC intelligence budget is exhausted", not an enum.
 */
export function checkSpendAuthority(input: {
  amountMicro: number;
  state: BudgetState;
}): SpendRefusal {
  const { amountMicro, state } = input;
  if (state.revoked) {
    return {
      ok: false,
      code: "revoked",
      reason: "Spending authority for this Mission has been revoked.",
    };
  }
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
      select: { budgetMicro: true, perPurchaseMicro: true, revokedAt: true },
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
      revoked: Boolean(budgetRow?.revokedAt),
    });

    if (existing) {
      return { ok: true, spendId: existing.id, state, reused: true } as const;
    }

    // Revocation is checked fresh on every reservation, not only when
    // authority was granted - a run that started before the kill switch was
    // hit must not be able to execute a purchase after it.
    if (budgetRow?.revokedAt) {
      return {
        ok: false,
        code: "revoked",
        reason: "Spending authority for this Mission has been revoked.",
        state,
      } as const;
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
        revoked: Boolean(budgetRow?.revokedAt),
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
      select: { budgetMicro: true, perPurchaseMicro: true, revokedAt: true },
    }),
    prisma.missionIntelligenceSpend.findMany({
      where: { missionId },
      select: { amountMicro: true, state: true },
    }),
  ]);
  return computeBudgetState({
    revoked: Boolean(budgetRow?.revokedAt),
    grantedMicro: budgetRow?.budgetMicro ?? 0,
    perPurchaseLimitMicro: budgetRow?.perPurchaseMicro ?? 0,
    entries: entries as SpendEntry[],
  });
}

/**
 * Sane ceiling on what any single grant can authorise. Not a product limit on
 * how much a Mission could ever cost - a guard against a typo or a bug
 * accidentally granting unbounded autonomous spending authority.
 */
const MAX_GRANT_MICRO = usdToMicro(5);
const MAX_PER_PURCHASE_MICRO = usdToMicro(1);

export type GrantResult =
  | { ok: true; state: BudgetState }
  | { ok: false; error: string };

/**
 * Grants (or updates) a Mission's autonomous spending authority. Idempotent
 * upsert - calling it again changes the limits, it does not add to them, so
 * repeating a grant can never silently compound authority.
 */
export async function grantMissionBudget(input: {
  missionId: string;
  budgetMicro: number;
  perPurchaseMicro: number;
}): Promise<GrantResult> {
  if (
    !Number.isInteger(input.budgetMicro) ||
    input.budgetMicro < 0 ||
    input.budgetMicro > MAX_GRANT_MICRO
  ) {
    return {
      ok: false,
      error: `Budget must be between 0 and ${formatUsdc(MAX_GRANT_MICRO)}.`,
    };
  }
  if (
    !Number.isInteger(input.perPurchaseMicro) ||
    input.perPurchaseMicro < 0 ||
    input.perPurchaseMicro > MAX_PER_PURCHASE_MICRO
  ) {
    return {
      ok: false,
      error: `Per-purchase limit must be between 0 and ${formatUsdc(MAX_PER_PURCHASE_MICRO)}.`,
    };
  }
  if (input.perPurchaseMicro > input.budgetMicro) {
    return {
      ok: false,
      error: "The per-purchase limit cannot exceed the total budget.",
    };
  }
  await ensureMissionBudgetSchema();
  await prisma.missionIntelligenceBudget.upsert({
    where: { missionId: input.missionId },
    create: {
      missionId: input.missionId,
      budgetMicro: input.budgetMicro,
      perPurchaseMicro: input.perPurchaseMicro,
    },
    update: {
      budgetMicro: input.budgetMicro,
      perPurchaseMicro: input.perPurchaseMicro,
      // A fresh grant re-authorises spending; it must not leave a prior
      // revocation in place.
      revokedAt: null,
    },
  });
  return { ok: true, state: await missionBudgetState(input.missionId) };
}

/** Kill switch. Reserved/submitted/confirmed spend already in flight is unaffected - see settleMissionSpend. */
export async function revokeMissionBudget(missionId: string): Promise<BudgetState> {
  await ensureMissionBudgetSchema();
  await prisma.missionIntelligenceBudget.upsert({
    where: { missionId },
    create: { missionId, budgetMicro: 0, perPurchaseMicro: 0, revokedAt: new Date() },
    update: { revokedAt: new Date() },
  });
  return missionBudgetState(missionId);
}

/** Clears the kill switch. Does not change the budget/per-purchase limits. */
export async function resumeMissionBudget(missionId: string): Promise<BudgetState> {
  await ensureMissionBudgetSchema();
  await prisma.missionIntelligenceBudget.updateMany({
    where: { missionId },
    data: { revokedAt: null },
  });
  return missionBudgetState(missionId);
}
