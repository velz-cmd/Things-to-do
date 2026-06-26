import { prisma } from "@/lib/db";
import { getArcReadiness, type ArcReadiness } from "@/lib/treasury/arc-readiness";

export type TreasurySnapshot = {
  balanceUsd: number;
  obligationsUsd: number;
  availableUsd: number;
  authorizedUsd: number;
  pendingFundingUsd: number;
  claimableUsd: number;
  fundingWallet: string | null;
  liveArc: boolean;
  canSettleGlobally: boolean;
  blockers: string[];
  message: string;
  arc: ArcReadiness;
};

export class TreasuryUnderfundedError extends Error {
  code = "TREASURY_UNDERFUNDED" as const;
  requiredUsd: number;
  availableUsd: number;

  constructor(requiredUsd: number, availableUsd: number) {
    super(
      `Treasury underfunded: ${availableUsd.toFixed(2)} USDC available, ${requiredUsd.toFixed(2)} required for global settlement`,
    );
    this.requiredUsd = requiredUsd;
    this.availableUsd = availableUsd;
  }
}

/** Unfulfilled ledger obligations — capital the treasury must cover for global settlement. */
export async function getTreasuryObligationsUsd() {
  const rows = await prisma.paymentAuthorization
    .groupBy({
      by: ["status"],
      _sum: { amountUsd: true },
    })
    .catch(() => []);

  const sum = (statuses: string[]) =>
    rows
      .filter((r) => statuses.includes(r.status))
      .reduce((s, r) => s + (r._sum.amountUsd ?? 0), 0);

  const authorizedUsd = sum(["authorized"]);
  const pendingFundingUsd = sum(["pending_funding"]);
  const claimableUsd = sum(["claimable"]);

  return {
    authorizedUsd: round(authorizedUsd),
    pendingFundingUsd: round(pendingFundingUsd),
    claimableUsd: round(claimableUsd),
    obligationsUsd: round(authorizedUsd + pendingFundingUsd + claimableUsd),
  };
}

export async function getTreasurySnapshot(requiredUsd = 0): Promise<TreasurySnapshot> {
  const [arc, obligations] = await Promise.all([
    getArcReadiness(requiredUsd),
    getTreasuryObligationsUsd(),
  ]);

  const balanceUsd = arc.balanceUsd ?? 0;
  const availableUsd = round(Math.max(0, balanceUsd - obligations.obligationsUsd));
  const blockers = [...arc.blockers];

  if (obligations.obligationsUsd > balanceUsd && balanceUsd > 0) {
    blockers.push(
      `Ledger obligations (${obligations.obligationsUsd.toFixed(2)} USDC) exceed treasury balance (${balanceUsd.toFixed(2)} USDC)`,
    );
  }

  const canSettleGlobally =
    arc.canDistributeOnChain &&
    availableUsd >= Math.max(requiredUsd, 0) &&
    (requiredUsd > 0 ? balanceUsd >= requiredUsd : balanceUsd >= 0.01);

  let message = "Global settlement ready — fund once, batch pay contributors worldwide";
  if (!arc.liveArc) {
    message = "Circle Arc not live — settlements recorded off-chain until treasury is configured";
  } else if (balanceUsd < 0.01) {
    message = "Fund ARC_CLIENT_WALLET_ADDRESS on Arc testnet to enable global batch settlement";
  } else if (availableUsd < requiredUsd && requiredUsd > 0) {
    message = `Need ${requiredUsd.toFixed(2)} USDC for this batch — ${availableUsd.toFixed(2)} available after obligations`;
  } else if (blockers.length > 0) {
    message = blockers[0]!;
  }

  return {
    balanceUsd: round(balanceUsd),
    obligationsUsd: obligations.obligationsUsd,
    availableUsd,
    authorizedUsd: obligations.authorizedUsd,
    pendingFundingUsd: obligations.pendingFundingUsd,
    claimableUsd: obligations.claimableUsd,
    fundingWallet: arc.clientWallet,
    liveArc: arc.liveArc,
    canSettleGlobally,
    blockers,
    message,
    arc,
  };
}

/** Gate before moving Authorization → Settlement on Circle Arc. */
export async function assertTreasuryCanFund(amountUsd: number) {
  const snap = await getTreasurySnapshot(amountUsd);
  if (!snap.liveArc) {
    return { ok: true as const, mode: "offchain" as const, snapshot: snap };
  }
  if (snap.balanceUsd < amountUsd) {
    throw new TreasuryUnderfundedError(amountUsd, snap.availableUsd);
  }
  if (!snap.arc.canDistributeOnChain) {
    return { ok: false as const, mode: "blocked" as const, snapshot: snap };
  }
  return { ok: true as const, mode: "onchain" as const, snapshot: snap };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
