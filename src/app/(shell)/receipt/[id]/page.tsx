import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicEarnReceipt } from "@/components/resolve/ledger/public-receipt";
import { buildPublicReceipt } from "@/lib/ledger/receipt";
import { receiptKindCopy } from "@/lib/receipt/copy";

type Props = { params: Promise<{ id: string }> };

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
  const receipt = await buildPublicReceipt(id);
  if (!receipt) notFound();

  return <PublicEarnReceipt receipt={receipt} />;
}
