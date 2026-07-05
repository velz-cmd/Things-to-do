import { prisma } from "@/lib/db";
import { connectorLabel } from "@/lib/ledger/labels";
import { explorerTxUrl } from "@/lib/settlement/arc-config";
import { isOnChainTxHash } from "@/lib/payment/tx-utils";
import { communityLabelForMission } from "@/lib/earn/community-label";
import { getProgramPoolState } from "@/lib/capital/pool-checkpoints";
import {
  buildLiveFundHeadline,
  buildLiveFundSubline,
  buildSourcedPoolHook,
} from "@/lib/discover/pool-discover-copy";

export type LiveSettlementRow = {
  id: string;
  kind: "fund" | "authorization" | "settlement";
  title: string;
  amountUsd: number;
  status: string;
  communitySlug?: string;
  communityName?: string;
  connectorLabel?: string;
  receiptHref?: string;
  explorerUrl?: string | null;
  at: string;
  /** Enriched for fund rows — real pool USD on ledger */
  poolBalanceUsd?: number;
  contributorCount?: number;
  funderCount?: number;
  payeeCategory?: string;
  /** Sourced one-liner for Discover strip */
  sourcedHook?: string;
  /** Secondary line under title */
  subline?: string;
};

export type LiveSettlementsPayload = {
  ok: true;
  live: boolean;
  rows: LiveSettlementRow[];
  updatedAt: string;
};

function roundUsd(n: number) {
  return Math.round(n * 100) / 100;
}

/** Recent real ledger + pool activity for Discover Arc strip — DB rows only. */
export async function buildLiveSettlements(limit = 12): Promise<LiveSettlementsPayload> {
  const take = Math.min(Math.max(limit, 1), 24);
  const rows: LiveSettlementRow[] = [];

  if (!process.env.DATABASE_URL) {
    return { ok: true, live: false, rows: [], updatedAt: new Date().toISOString() };
  }

  const [stakes, authorizations, settlements] = await Promise.all([
    prisma.communityFundStake.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        principalUsd: true,
        createdAt: true,
        programId: true,
        program: {
          select: {
            id: true,
            name: true,
            missionId: true,
            templateId: true,
            install: { select: { communitySlug: true } },
          },
        },
      },
    }),
    prisma.paymentAuthorization.findMany({
      where: { status: { in: ["settled", "claimable", "claimed", "authorized"] } },
      orderBy: { updatedAt: "desc" },
      take,
      select: {
        id: true,
        amountUsd: true,
        status: true,
        connectorId: true,
        missionId: true,
        updatedAt: true,
        settlementId: true,
      },
    }),
    prisma.missionSettlement.findMany({
      where: { escrowTxHash: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: Math.ceil(take / 2),
      select: {
        id: true,
        treasuryAmount: true,
        status: true,
        missionId: true,
        escrowTxHash: true,
        updatedAt: true,
      },
    }),
  ]);

  const missionCache = new Map<string, Awaited<ReturnType<typeof communityLabelForMission>>>();

  async function missionMeta(missionId: string) {
    let cached = missionCache.get(missionId);
    if (!cached) {
      cached = await communityLabelForMission(missionId);
      missionCache.set(missionId, cached);
    }
    return cached;
  }

  for (const stake of stakes) {
    const meta = stake.program.missionId ? await missionMeta(stake.program.missionId) : null;
    const poolState = await getProgramPoolState(stake.programId).catch(() => null);
    const programName = stake.program.name ?? meta?.programName ?? "Program pool";
    const sourcedHook =
      poolState?.sourcedHook ??
      buildSourcedPoolHook({
        programName,
        poolBalanceUsd: stake.principalUsd,
        owedToCreatorsUsd: 0,
        claimableUsd: 0,
        nextCheckpointUsd: null,
        progressToNextPct: 0,
        payeeCategory: poolState?.payeeCategory ?? "contributors",
        funderCount: poolState?.funderCount ?? 1,
        contributorCount: poolState?.contributorCount ?? 0,
      });

    const poolBalanceUsd = poolState?.poolBalanceUsd ?? roundUsd(stake.principalUsd);
    const contributorCount = poolState?.contributorCount ?? 0;
    const funderCount = poolState?.funderCount ?? 1;
    const payeeCategory = poolState?.payeeCategory ?? "contributors";

    rows.push({
      id: `stake-${stake.id}`,
      kind: "fund",
      title: buildLiveFundHeadline({
        programName,
        amountUsd: roundUsd(stake.principalUsd),
        poolBalanceUsd,
        contributorCount,
        funderCount,
        payeeCategory,
        sourcedHook,
      }),
      subline: buildLiveFundSubline(sourcedHook),
      amountUsd: roundUsd(stake.principalUsd),
      status: "funded",
      communitySlug: stake.program.install?.communitySlug ?? meta?.communitySlug,
      communityName: meta?.communityName,
      poolBalanceUsd,
      contributorCount,
      funderCount,
      payeeCategory,
      sourcedHook,
      receiptHref: stake.program.install?.communitySlug
        ? `/communities/${stake.program.install.communitySlug}?intent=fund&program=${encodeURIComponent(stake.programId)}`
        : "/capital",
      at: stake.createdAt.toISOString(),
    });
  }

  for (const auth of authorizations) {
    const meta = await missionMeta(auth.missionId);
    rows.push({
      id: `auth-${auth.id}`,
      kind: "authorization",
      title: `$${roundUsd(auth.amountUsd).toFixed(2)} recognized · ${meta.programName ?? meta.communityName ?? "Verified value"}`,
      subline: `${connectorLabel(auth.connectorId)} · ${auth.status.replace(/_/g, " ")}`,
      amountUsd: roundUsd(auth.amountUsd),
      status: auth.status,
      communitySlug: meta.communitySlug,
      communityName: meta.communityName,
      connectorLabel: connectorLabel(auth.connectorId),
      receiptHref: `/receipt/${auth.id}`,
      at: auth.updatedAt.toISOString(),
    });
  }

  for (const settlement of settlements) {
    const meta = await missionMeta(settlement.missionId);
    const tx = settlement.escrowTxHash;
    rows.push({
      id: `settlement-${settlement.id}`,
      kind: "settlement",
      title: `$${roundUsd(settlement.treasuryAmount).toFixed(0)} batch · ${meta.programName ?? meta.communityName ?? "Settlement"}`,
      subline: "2.5% platform fee · remainder to creators on Arc",
      amountUsd: roundUsd(settlement.treasuryAmount),
      status: settlement.status,
      communitySlug: meta.communitySlug,
      communityName: meta.communityName,
      receiptHref: `/receipt/${settlement.id}`,
      explorerUrl: isOnChainTxHash(tx) ? explorerTxUrl(tx!) : null,
      at: settlement.updatedAt.toISOString(),
    });
  }

  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    ok: true,
    live: rows.length > 0,
    rows: rows.slice(0, take),
    updatedAt: new Date().toISOString(),
  };
}
