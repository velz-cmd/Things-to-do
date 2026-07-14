"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CircleDollarSign, Pause, Play, Rocket, ShieldCheck } from "lucide-react";

export type CreatorAssetView = { id: string; title: string; canonicalUrl: string; sourceAdapterId: string; ownershipState: string; ownershipChallenge: string | null };
export type CreatorCampaignView = { id: string; name: string; status: string; assetId: string; totalBudgetMicroUsdc: string; recognizedMicroUsdc: string; settledMicroUsdc: string; fundingIntentId: string | null };

async function post(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const data = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Action could not complete.");
  return data;
}

function micro(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(normalized)) throw new Error("Use a positive USDC amount with at most six decimal places.");
  const [whole, fraction = ""] = normalized.split(".");
  return (BigInt(whole!) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"))).toString();
}

function displayMicro(value: string) {
  const padded = value.padStart(7, "0");
  const whole = padded.slice(0, -6).replace(/^0+(?=\d)/, "");
  const fraction = padded.slice(-6).replace(/0+$/, "");
  return `$${whole}${fraction ? `.${fraction}` : ""}`;
}

export function OutcomeCreatorConsole({ assets, campaigns }: { assets: CreatorAssetView[]; campaigns: CreatorCampaignView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function execute(key: string, url: string, body?: Record<string, unknown>) {
    setBusy(key); setMessage(null);
    try { const result = await post(url, body); setMessage(typeof result.blocker === "string" ? result.blocker : "Action completed and recorded."); router.refresh(); return result; }
    catch (error) { setMessage(error instanceof Error ? error.message : "Action failed."); return null; }
    finally { setBusy(null); }
  }

  async function registerAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const result = await execute("asset", "/api/outcomes/assets", { type: form.get("type"), canonicalUrl: form.get("canonicalUrl"), title: form.get("title"), description: form.get("description") || undefined, sourceAdapterId: form.get("sourceAdapterId") });
    if (result) event.currentTarget.reset();
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      const budget = micro(form.get("budget")); const rate = micro(form.get("rate")); const participantCap = form.get("participantCap") ? micro(form.get("participantCap")) : undefined;
      const asset = assets.find((item) => item.id === form.get("assetId"));
      if (!asset) throw new Error("Choose a registered asset.");
      const verificationAdapterId = String(form.get("verificationAdapterId") ?? "");
      const unitType = verificationAdapterId === "github" ? "events" : "views";
      const result = await execute("campaign", "/api/outcomes/campaigns", { assetId: asset.id, name: form.get("name"), objective: form.get("objective"), contributionType: form.get("contributionType"), verificationAdapterId, totalBudgetMicroUsdc: budget, participantCapMicroUsdc: participantCap, startsAt: new Date().toISOString(), formula: { mode: "per_unit", unitType, rateMicroUsdc: rate, minimumUnits: "1" } });
      if (result) event.currentTarget.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Campaign amount is invalid."); }
  }

  async function lifecycle(campaign: CreatorCampaignView, action: string) {
    const routes: Record<string, [string, Record<string, unknown>?]> = {
      simulate: [`/api/outcomes/campaigns/${campaign.id}/simulate`], approve: [`/api/outcomes/campaigns/${campaign.id}/approve`], publish: [`/api/outcomes/campaigns/${campaign.id}/publish`],
      pause: [`/api/outcomes/campaigns/${campaign.id}/state`, { action: "pause" }], resume: [`/api/outcomes/campaigns/${campaign.id}/state`, { action: "resume" }], close: [`/api/outcomes/campaigns/${campaign.id}/state`, { action: "close" }], settlement: [`/api/outcomes/campaigns/${campaign.id}/settlement`],
    };
    const route = routes[action]; if (!route) return;
    const result = await execute(`${campaign.id}:${action}`, route[0], route[1]);
    if (result && typeof result.capitalUrl === "string") router.push(result.capitalUrl);
  }

  return <div className="mt-5 grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
    <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5"><p className="text-xs uppercase tracking-wider text-cyan-300">Creator setup</p><h2 className="mt-1 text-xl font-semibold text-white">Register and prove the asset</h2><form onSubmit={registerAsset} className="mt-4 grid gap-3"><label className="text-xs text-slate-400">Provider<select name="sourceAdapterId" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"><option value="peertube">PeerTube public metrics</option><option value="github">GitHub pull request</option></select></label><label className="text-xs text-slate-400">Asset type<select name="type" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"><option value="video">Video</option><option value="repository">Repository work</option></select></label><label className="text-xs text-slate-400">Canonical URL<input required name="canonicalUrl" type="url" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"/></label><label className="text-xs text-slate-400">Title<input required minLength={2} name="title" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"/></label><label className="text-xs text-slate-400">Description<textarea name="description" rows={2} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"/></label><button disabled={busy === "asset"} className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Register asset</button></form><div className="mt-4 space-y-2">{assets.map((asset) => <article key={asset.id} className="rounded-lg border border-white/10 p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm text-white">{asset.title}</strong><span className="text-xs text-slate-400">{asset.ownershipState.replaceAll("_", " ")}</span></div>{asset.ownershipState !== "verified" && <><code className="mt-2 block break-all rounded bg-black/30 p-2 text-xs text-cyan-200">{asset.ownershipChallenge ?? "Requesting challenge…"}</code><p className="mt-2 text-xs text-slate-500">Add this code to the source description, save it, then verify.</p><button type="button" onClick={() => execute(`${asset.id}:verify`, `/api/outcomes/assets/${asset.id}/ownership`)} disabled={busy === `${asset.id}:verify`} className="mt-2 rounded-lg border border-cyan-300/20 px-3 py-2 text-xs text-cyan-200">Verify ownership</button></>}</article>)}</div></section>
    <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5"><p className="text-xs uppercase tracking-wider text-violet-300">Policy compiler</p><h2 className="mt-1 text-xl font-semibold text-white">Create a capped Outcome Campaign</h2><form onSubmit={createCampaign} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400 sm:col-span-2">Asset<select required name="assetId" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"><option value="">Choose an asset</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.ownershipState}</option>)}</select></label><label className="text-xs text-slate-400 sm:col-span-2">Campaign name<input required minLength={3} name="name" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"/></label><label className="text-xs text-slate-400 sm:col-span-2">Outcome objective<textarea required minLength={10} name="objective" rows={3} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"/></label><label className="text-xs text-slate-400">Contribution type<input required name="contributionType" placeholder="qualified_view" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"/></label><label className="text-xs text-slate-400">Verification<select name="verificationAdapterId" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"><option value="peertube">PeerTube</option><option value="github">GitHub</option></select></label><label className="text-xs text-slate-400">Budget USDC<input required name="budget" inputMode="decimal" placeholder="100" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"/></label><label className="text-xs text-slate-400">Rate per unit USDC<input required name="rate" inputMode="decimal" placeholder="0.10" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"/></label><input type="hidden" name="unitType" value="views"/><label className="text-xs text-slate-400 sm:col-span-2">Participant cap USDC <span className="text-slate-600">optional</span><input name="participantCap" inputMode="decimal" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-sm text-white"/></label><button disabled={busy === "campaign" || !assets.length} className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">Create draft and immutable policy</button></form></section>
    {message && <p role="status" className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm text-cyan-100 xl:col-span-2">{message}</p>}
    <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 xl:col-span-2"><h2 className="text-xl font-semibold text-white">Campaign operations</h2>{!campaigns.length ? <p className="mt-3 text-sm text-slate-400">No Outcome Campaign has been created.</p> : <div className="mt-4 divide-y divide-white/10">{campaigns.map((campaign) => <article key={campaign.id} className="grid gap-4 py-4 lg:grid-cols-[1fr_120px_120px_120px_auto]"><div><strong className="text-white">{campaign.name}</strong><p className="text-xs text-slate-500">{campaign.status.replaceAll("_", " ")}</p></div><Metric icon={CircleDollarSign} label="Budget" value={campaign.totalBudgetMicroUsdc}/><Metric icon={BadgeCheck} label="Recognized" value={campaign.recognizedMicroUsdc}/><Metric icon={ShieldCheck} label="Settled" value={campaign.settledMicroUsdc}/><div className="flex flex-wrap items-center gap-2">{campaign.status === "simulation_required" && <Action label="Simulate" icon={Play} onClick={() => lifecycle(campaign, "simulate")}/>} {campaign.status === "approval_required" && <Action label="Approve" icon={ShieldCheck} onClick={() => lifecycle(campaign, "approve")}/>} {campaign.status === "funding_required" && campaign.fundingIntentId && <a className="rounded-lg bg-violet-500 px-3 py-2 text-xs text-white" href={`/capital?fundingIntent=${campaign.fundingIntentId}&returnTo=${encodeURIComponent("/earn?mode=creator")}`}>Fund in Capital</a>} {campaign.status === "ready_to_publish" && <Action label="Publish" icon={Rocket} onClick={() => lifecycle(campaign, "publish")}/>} {campaign.status === "active" && <Action label="Pause" icon={Pause} onClick={() => lifecycle(campaign, "pause")}/>} {campaign.status === "paused" && <Action label="Resume" icon={Play} onClick={() => lifecycle(campaign, "resume")}/>} {["active", "paused"].includes(campaign.status) && <button onClick={() => lifecycle(campaign, "close")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Close</button>} {["active", "paused", "closed"].includes(campaign.status) && <button onClick={() => lifecycle(campaign, "settlement")} className="rounded-lg border border-emerald-300/20 px-3 py-2 text-xs text-emerald-200">Prepare settlement</button>}</div></article>)}</div>}</section>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof CircleDollarSign; label: string; value: string }) { return <div><span className="flex items-center gap-1 text-xs text-slate-500"><Icon className="h-3.5 w-3.5"/>{label}</span><strong className="mt-1 block font-mono text-sm text-white">{displayMicro(value)}</strong></div>; }
function Action({ label, icon: Icon, onClick }: { label: string; icon: typeof Play; onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white"><Icon className="h-3.5 w-3.5"/>{label}</button>; }
