import { prisma } from "@/lib/db";
import { connectorLabel } from "@/lib/ledger/labels";
import { explorerTxUrl } from "@/lib/settlement/arc-config";
import { isOnChainTxHash } from "@/lib/payment/tx-utils";
import { communityLabelForMission } from "@/lib/earn/community-label";

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
        program: {
          select: {
            name: true,
            missionId: true,
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
    rows.push({
      id: `stake-${stake.id}`,
      kind: "fund",
      title: stake.program.name ?? meta?.programName ?? "Program pool",
      amountUsd: roundUsd(stake.principalUsd),
      status: "funded",
      communitySlug: stake.program.install?.communitySlug ?? meta?.communitySlug,
      communityName: meta?.communityName,
      receiptHref: stake.program.install?.communitySlug
        ? `/communities/${stake.program.install.communitySlug}`
        : "/capital",
      at: stake.createdAt.toISOString(),
    });
  }

  for (const auth of authorizations) {
    const meta = await missionMeta(auth.missionId);
    rows.push({
      id: `auth-${auth.id}`,
      kind: "authorization",
      title: meta.programName ?? meta.communityName ?? "Verified value",
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
      title: meta.programName ?? meta.communityName ?? "Batch settlement",
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
