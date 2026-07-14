import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, ExternalLink, FileKey2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatUsdcTokenUnits } from "@/lib/money/usdc";

export const metadata: Metadata = { title: "Outcome receipt — RESOLVE", description: "Privacy-safe proof of a verified outcome and its settlement." };
function text(value: unknown, fallback = "Not disclosed") { return typeof value === "string" && value.trim() ? value : fallback; }
function formatMicro(value: bigint) { return `$${formatUsdcTokenUnits(value)} USDC`; }

export default async function PublicOutcomeReceiptPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const receipt = await prisma.receipt.findUnique({ where: { publicReference: publicId } });
  if (!receipt) notFound();
  const transaction = await prisma.chainTransaction.findUnique({ where: { id: receipt.chainTransactionId } });
  const payload = receipt.payload && typeof receipt.payload === "object" && !Array.isArray(receipt.payload) ? receipt.payload as Record<string, unknown> : {};
  const explorer = transaction?.txHash ? `https://testnet.arcscan.app/tx/${transaction.txHash}` : null;
  return <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><header className="rounded-2xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.16),transparent_42%),#07101b] p-7"><div className="flex items-center gap-2 text-emerald-300"><BadgeCheck className="h-5 w-5"/><span className="text-xs font-semibold uppercase tracking-[.2em]">Verified outcome receipt</span></div><h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">This outcome happened, its policy recognized it, and Capital recorded its settlement.</h1><p className="mt-3 font-mono text-sm text-slate-400">{receipt.publicReference}</p></header><section className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">{[
    ["Campaign", text(payload.campaignName ?? payload.campaignId)], ["Creator / project", text(payload.creatorLabel ?? payload.communitySlug ?? receipt.communitySlug)], ["Contributor", text(payload.contributorLabel)], ["Work reference", text(payload.workReference)], ["Verified outcome", text(payload.verifiedOutcome)], ["Evidence source", text(payload.evidenceSource)], ["Policy version", text(payload.policyVersionId)], ["Amount", formatMicro(receipt.totalUsdcMicro)], ["Settlement state", transaction?.status ?? "recorded"], ["Timestamp", receipt.issuedAt.toISOString()], ["Content hash", text(payload.contentHash)],
  ].map(([label, value]) => <div key={label} className="bg-slate-950 p-5"><dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-2 break-words text-sm text-white">{value}</dd></div>)}</section>{transaction?.txHash && <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-950/60 p-5"><div><p className="flex items-center gap-2 text-sm font-medium text-white"><FileKey2 className="h-4 w-4 text-violet-300"/>Arc transaction</p><code className="mt-2 block break-all text-xs text-slate-400">{transaction.txHash}</code></div>{explorer && <a href={explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-violet-300">Open explorer <ExternalLink className="h-3.5 w-3.5"/></a>}</section>}</main>;
}
