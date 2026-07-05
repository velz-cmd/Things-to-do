import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicEarnReceipt } from "@/components/resolve/ledger/public-receipt";
import { buildPublicReceipt, type PublicReceipt } from "@/lib/ledger/receipt";
import { receiptKindCopy } from "@/lib/receipt/copy";
import { prisma } from "@/lib/db";
import { getProgramPoolState } from "@/lib/capital/pool-checkpoints";

type Props = { params: Promise<{ id: string }> };

async function enrichReceiptWithPool(receipt: PublicReceipt): Promise<PublicReceipt> {
  if (!process.env.DATABASE_URL) return receipt;
  const program = await prisma.resolveProgram.findFirst({
    where: { missionId: receipt.mission.id },
    select: { id: true },
  });
  if (!program) return receipt;
  const pool = await getProgramPoolState(program.id);
  if (!pool) return receipt;
  return {
    ...receipt,
    poolSummary: {
      poolBalanceUsd: pool.poolBalanceUsd,
      owedToCreatorsUsd: pool.owedToCreatorsUsd,
      nextCheckpointUsd: pool.nextCheckpointUsd,
      progressToNextPct: pool.progressToNextPct,
      payeeCategory: pool.payeeCategory,
    },
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const receipt = await buildPublicReceipt(id);
  if (!receipt) return { title: "Receipt — RESOLVE" };

  const copy = receiptKindCopy(receipt.kind);
  return {
    title: `${copy.badge} · $${receipt.amountUsd.toFixed(2)} — ${receipt.mission.communityName}`,
    description: `${copy.subtitle} ${receipt.mission.communityName} · ${receipt.connector.label}.`,
    openGraph: {
      title: `RESOLVE ${copy.badge} — $${receipt.amountUsd.toFixed(2)}`,
      description: `${receipt.mission.communityName} · ${receipt.connector.label}`,
    },
  };
}

export default async function ReceiptPage({ params }: Props) {
  const { id } = await params;
  const base = await buildPublicReceipt(id);
  if (!base) notFound();
  const receipt = await enrichReceiptWithPool(base);

  return <PublicEarnReceipt receipt={receipt} />;
}
