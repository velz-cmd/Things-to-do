import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicLedgerReceipt } from "@/components/resolve/ledger/public-receipt";
import { buildPublicReceipt } from "@/lib/ledger/receipt";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const receipt = await buildPublicReceipt(id);
  if (!receipt) return { title: "Receipt — RESOLVE" };

  const kind = receipt.kind === "signal" ? "Signal" : "Ledger";
  return {
    title: `${kind} · $${receipt.amountUsd.toFixed(2)} — ${receipt.mission.communityName}`,
    description: `Verified ${receipt.connector.label} settlement for ${receipt.mission.communityName} on RESOLVE.`,
    openGraph: {
      title: `RESOLVE ${kind} — $${receipt.amountUsd.toFixed(2)}`,
      description: `${receipt.mission.communityName} · ${receipt.connector.label}`,
    },
  };
}

export default async function LedgerReceiptPage({ params }: Props) {
  const { id } = await params;
  const receipt = await buildPublicReceipt(id);
  if (!receipt) notFound();

  return <PublicLedgerReceipt receipt={receipt} />;
}
