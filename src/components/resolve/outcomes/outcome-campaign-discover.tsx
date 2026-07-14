"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BadgeCheck, CircleDollarSign, Send, Users } from "lucide-react";

type Campaign = {
  id: string; name: string; objective: string; contributionType: string; verificationAdapterId: string;
  assetTitle: string; assetUrl: string | null; joined: boolean; identityConnected: boolean;
  totalBudgetMicroUsdc: string; committedMicroUsdc: string; participantCapMicroUsdc: string | null; endsAt: string | null;
};

async function loadCampaigns(): Promise<Campaign[]> {
  const response = await fetch("/api/outcomes/campaigns", { credentials: "include" });
  if (!response.ok) throw new Error("Campaigns are temporarily unavailable.");
  return ((await response.json()) as { campaigns: Campaign[] }).campaigns;
}

async function mutate(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const payload = await response.json().catch(() => ({})) as { error?: string; blocker?: string };
  if (!response.ok) throw new Error(payload.error ?? "The campaign action could not complete.");
  return payload;
}

function money(micro: string) {
  const value = micro.padStart(7, "0");
  const whole = value.slice(0, -6).replace(/^0+(?=\d)/, "");
  const fraction = value.slice(-6).replace(/0+$/, "");
  return `$${whole}${fraction ? `.${fraction}` : ""}`;
}

export function OutcomeCampaignDiscover({ signedIn }: { signedIn: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["outcome-campaigns"], queryFn: loadCampaigns, staleTime: 30_000 });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitId, setSubmitId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function join(campaign: Campaign) {
    setBusyId(campaign.id); setMessage(null);
    try {
      const result = await mutate(`/api/outcomes/campaigns/${encodeURIComponent(campaign.id)}/participants`);
      setMessage(result.blocker ?? "Campaign joined. Submit your canonical work URL when it is ready.");
      await queryClient.invalidateQueries({ queryKey: ["outcome-campaigns"] });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Join failed."); }
    finally { setBusyId(null); }
  }

  async function submit(event: FormEvent<HTMLFormElement>, campaign: Campaign) {
    event.preventDefault(); setBusyId(campaign.id); setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      await mutate("/api/outcomes/submissions", { campaignId: campaign.id, workUrl: String(form.get("workUrl") ?? ""), sourceReference: String(form.get("sourceReference") ?? "") || undefined });
      setMessage("Baseline captured from the live provider. Future verified growth can now be recognized.");
      setSubmitId(null); event.currentTarget.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Submission failed."); }
    finally { setBusyId(null); }
  }

  const campaigns = query.data ?? [];
  return <section id="outcome-campaigns" data-testid="outcome-campaigns" className="rounded-2xl border border-violet-400/20 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,.14),transparent_38%),rgba(3,10,24,.86)] p-4 sm:p-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-cyan-300">Outcome campaigns</p><h2 className="mt-1 text-xl font-semibold text-white">Contribute where the work already happens.</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Join a funded policy, publish on its supported platform, and earn only when RESOLVE verifies the stated outcome.</p></div><Link href="/earn" className="inline-flex items-center gap-1 text-sm text-violet-300">Open Earn <ArrowUpRight className="h-4 w-4"/></Link></div>
    {message && <p role="status" className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-sm text-cyan-100">{message}</p>}
    {query.isLoading && <p className="mt-5 text-sm text-slate-400">Loading funded campaigns…</p>}
    {query.isError && <p role="alert" className="mt-5 text-sm text-amber-200">{query.error.message}</p>}
    {!query.isLoading && !campaigns.length && <div className="mt-5 rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-400">No funded Outcome Campaign is currently accepting submissions. Static examples are not shown as live work.</div>}
    <div className="mt-5 grid gap-3 lg:grid-cols-2">{campaigns.map((campaign) => {
      const remaining = (BigInt(campaign.totalBudgetMicroUsdc) - BigInt(campaign.committedMicroUsdc)).toString();
      return <article key={campaign.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-cyan-300">{campaign.assetTitle}</p><h3 className="mt-1 font-semibold text-white">{campaign.name}</h3></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-2 py-1 text-[10px] uppercase tracking-wider text-emerald-300">Funded</span></div><p className="mt-3 line-clamp-2 text-sm text-slate-400">{campaign.objective}</p><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><span><CircleDollarSign className="mb-1 h-4 w-4 text-violet-300"/><b className="block font-mono text-white">{money(remaining)}</b><i className="not-italic text-slate-500">remaining</i></span><span><BadgeCheck className="mb-1 h-4 w-4 text-cyan-300"/><b className="block text-white">{campaign.verificationAdapterId}</b><i className="not-italic text-slate-500">evidence</i></span><span><Users className="mb-1 h-4 w-4 text-emerald-300"/><b className="block font-mono text-white">{campaign.participantCapMicroUsdc ? money(campaign.participantCapMicroUsdc) : "Policy cap"}</b><i className="not-italic text-slate-500">per person</i></span></div>
        <div className="mt-4 flex flex-wrap gap-2">{!signedIn ? <Link href="/profile" className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white">Sign in to join</Link> : !campaign.joined ? <button type="button" onClick={() => join(campaign)} disabled={busyId === campaign.id} className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId === campaign.id ? "Joining…" : "Join campaign"}</button> : <button type="button" onClick={() => setSubmitId(submitId === campaign.id ? null : campaign.id)} className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950"><Send className="mr-1 inline h-3.5 w-3.5"/>Submit work</button>}{campaign.assetUrl && <a href={campaign.assetUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">View source</a>}</div>
        {submitId === campaign.id && <form onSubmit={(event) => submit(event, campaign)} className="mt-3 grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3"><label className="text-xs text-slate-300">Canonical work URL<input name="workUrl" type="url" required placeholder={campaign.verificationAdapterId === "github" ? "https://github.com/owner/repo/pull/123" : "https://instance.example/w/video-id"} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"/></label><label className="text-xs text-slate-300">Reference note <span className="text-slate-600">optional</span><input name="sourceReference" maxLength={500} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"/></label><button disabled={busyId === campaign.id} className="mt-1 justify-self-start rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Capture baseline</button></form>}
      </article>;
    })}</div>
  </section>;
}
