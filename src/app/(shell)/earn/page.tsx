import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatUsdcTokenUnits } from "@/lib/money/usdc";
import { OutcomeCreatorConsole, type CreatorAssetView, type CreatorCampaignView } from "@/components/resolve/outcomes/outcome-creator-console";
import { OutcomeContributorConsole, type ContributorIdentityView, type ContributorPayoutView, type ContributorWorkView } from "@/components/resolve/outcomes/outcome-contributor-console";

export const metadata: Metadata = { title: "Earn — RESOLVE", description: "Verified work, recognized earnings, settlement state, and receipts." };
const states = ["recognized", "awaiting_authorization", "awaiting_settlement", "claimable", "settled"] as const;
const labels = { recognized: "Recognized", awaiting_authorization: "Awaiting authorization", awaiting_settlement: "Awaiting settlement", claimable: "Available to claim", settled: "Lifetime settled" } as const;
const usdc = (value: bigint) => `$${formatUsdcTokenUnits(value)}`;

export default async function EarnPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const mode = (await searchParams).mode === "creator" ? "creator" : "contributor";
  const user = await getSessionUser();
  const summary = Object.fromEntries(states.map((state) => [state, BigInt(0)])) as Record<(typeof states)[number], bigint>;
  let work: ContributorWorkView[] = []; let assets: CreatorAssetView[] = []; let campaigns: CreatorCampaignView[] = []; let identities: ContributorIdentityView[] = []; let payouts: ContributorPayoutView[] = []; let dataUnavailable = false;
  if (user) try {
    const [ledger, submissions, ownedAssets, ownedCampaigns, verifiedIdentities] = await Promise.all([
      prisma.earningsLedgerEntry.groupBy({ by: ["state"], where: { userId: user.id }, _sum: { amountMicroUsdc: true } }),
      prisma.workSubmission.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, workUrl: true, status: true, updatedAt: true, campaignId: true } }),
      prisma.creatorAsset.findMany({ where: { ownerUserId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, canonicalUrl: true, sourceAdapterId: true, ownershipState: true, ownershipChallenge: true } }),
      prisma.outcomeCampaign.findMany({ where: { creatorUserId: user.id }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, name: true, status: true, assetId: true, totalBudgetMicroUsdc: true, recognizedMicroUsdc: true, settledMicroUsdc: true, fundingIntentId: true } }),
      prisma.identity.findMany({ where: { userId: user.id, status: "verified" }, orderBy: { verifiedAt: "desc" }, select: { id: true, canonicalRef: true, displayName: true } }),
    ]);
    for (const row of ledger) if (states.includes(row.state as (typeof states)[number])) summary[row.state as (typeof states)[number]] = row._sum.amountMicroUsdc ?? BigInt(0);
    const workLedger = submissions.length ? await prisma.earningsLedgerEntry.findMany({ where: { submissionId: { in: submissions.map((item) => item.id) }, receiptId: { not: null } }, select: { submissionId: true, receiptId: true } }) : [];
    const receipts = workLedger.length ? await prisma.receipt.findMany({ where: { id: { in: workLedger.flatMap((item) => item.receiptId ? [item.receiptId] : []) } }, select: { id: true, publicReference: true } }) : [];
    const submissionCampaigns = submissions.length ? await prisma.outcomeCampaign.findMany({ where: { id: { in: [...new Set(submissions.map((item) => item.campaignId))] } }, select: { id: true, verificationAdapterId: true } }) : [];
    work = submissions.map((item) => { const entry = workLedger.find((row) => row.submissionId === item.id); return { ...item, provider: submissionCampaigns.find((campaign) => campaign.id === item.campaignId)?.verificationAdapterId ?? "unknown", updatedAt: item.updatedAt.toISOString(), receiptPublicReference: receipts.find((receipt) => receipt.id === entry?.receiptId)?.publicReference ?? null }; });
    assets = ownedAssets; campaigns = ownedCampaigns.map((item) => ({ ...item, totalBudgetMicroUsdc: item.totalBudgetMicroUsdc.toString(), recognizedMicroUsdc: item.recognizedMicroUsdc.toString(), settledMicroUsdc: item.settledMicroUsdc.toString() })); identities = verifiedIdentities;
    payouts = identities.length ? await prisma.payoutDestination.findMany({ where: { identityId: { in: identities.map((identity) => identity.id) }, status: "verified" }, select: { id: true, identityId: true, network: true, address: true } }) : [];
  } catch { dataUnavailable = true; }

  return <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8"><header className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(83,75,201,.2),transparent_40%),#07101f] p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">{mode === "creator" ? "Creator operations" : "Earn"}</p><h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">{mode === "creator" ? "Turn content and projects into verified growth campaigns." : "Work on real outcomes. Get paid when the proof is real."}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{mode === "creator" ? "Define the outcome, prove ownership, cap the policy, authorize funding, and settle only verified obligations." : "Join funded work, bind your real provider identity, synchronize proof, and follow every earning into its Arc receipt."}</p></div><nav className="flex rounded-xl border border-white/10 bg-black/20 p-1" aria-label="Earn mode"><Link className={`rounded-lg px-4 py-2 text-sm ${mode === "contributor" ? "bg-white/10 text-white" : "text-slate-400"}`} href="/earn?mode=contributor">Contributor</Link><Link className={`rounded-lg px-4 py-2 text-sm ${mode === "creator" ? "bg-white/10 text-white" : "text-slate-400"}`} href="/earn?mode=creator">Creator</Link></nav></div></header>
    {!user && <section className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-5"><h2 className="font-medium text-white">Sign in to open your economic workspace</h2><p className="mt-1 text-sm text-slate-400">Public Outcome Campaigns remain available in Discover.</p></section>}
    {dataUnavailable && <section role="alert" className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">Outcome records are not available in this environment yet. No balances or campaign results have been invented.</section>}
    {mode === "contributor" && <><section className="mt-5 grid overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 sm:grid-cols-5">{states.map((state) => <div key={state} className="border-b border-white/10 p-4 last:border-0 sm:border-b-0 sm:border-r"><p className="text-xs text-slate-500">{labels[state]}</p><strong className="mt-1 block font-mono text-lg text-white">{usdc(summary[state])}</strong></div>)}</section>{user ? <OutcomeContributorConsole identities={identities} payouts={payouts} work={work}/> : <section className="mt-5 rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-400">Sign in before joining or submitting to a funded campaign.</section>}</>}
    {mode === "creator" && (user ? <OutcomeCreatorConsole assets={assets} campaigns={campaigns}/> : <section className="mt-5 rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-400">Sign in before registering an asset or creating a campaign.</section>)}
  </main>;
}
