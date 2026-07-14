"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FileCheck2, ShieldAlert, Sparkles } from "lucide-react";
import { missionActionIds, type MissionActionId } from "@/lib/mission/actions/action-registry";

type Artifact = { id: string; type: string; title: string; state: "completed" | "blocked"; detail: string; reason: string };
const primary: MissionActionId[] = ["mission.investigate", "mission.verify_claim", "mission.compare_options"];

export function MissionCompiler() {
  const [objective, setObjective] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [running, setRunning] = useState<MissionActionId | null>(null);

  async function run(actionId: MissionActionId) {
    if (objective.trim().length < 3) return;
    setRunning(actionId);
    const action = missionActionIds.includes(actionId) ? actionId : "mission.investigate";
    const evidenceRequired = action !== "mission.investigate" && action !== "mission.purchase_signal" && action !== "mission.commission_specialist";
    const artifact: Artifact = {
      id: crypto.randomUUID(), type: action.replace("mission.", ""),
      title: action.replace("mission.", "").replaceAll("_", " "),
      state: evidenceRequired ? "blocked" : "completed",
      detail: evidenceRequired ? "Blocked: no attached evidence bundle yet. Investigate the objective or attach an approved source." : "Objective accepted. The investigation scope is ready for approved sources.",
      reason: evidenceRequired ? "This operation requires an evidence-backed artifact." : "This is the shortest valid first step for the requested objective.",
    };
    setArtifacts((current) => [artifact, ...current]);
    setRunning(null);
  }

  return <div className="mx-auto grid max-w-[1480px] gap-5 px-4 py-6 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
    <aside className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"><p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300">Mission library</p><p className="mt-4 text-sm text-slate-400">Persistent decision work appears here after an objective is accepted.</p></aside>
    <main className="min-w-0 rounded-2xl border border-violet-400/20 bg-[radial-gradient(circle_at_top,#19275c,transparent_48%),#060b19] p-5 shadow-2xl shadow-violet-950/30">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">Evidence-to-decision compiler</p><h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white">Define a decision. Compile only the evidence it needs.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Mission prepares verifiable artifacts and handoffs. Communities and Capital remain responsible for operating programs and settlement.</p>
      <label className="mt-6 block text-sm font-medium text-slate-200" htmlFor="mission-objective">Objective</label><textarea id="mission-objective" value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="For example: verify authorship for the documentation release and prepare a policy recommendation." className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-slate-950/80 p-4 text-sm text-white outline-none ring-violet-400/50 placeholder:text-slate-500 focus:ring-2" />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{primary.map((id) => <button key={id} type="button" data-action-id={id} data-testid={`mission-action-${id}`} disabled={!objective.trim() || running !== null} onClick={() => void run(id)} className="rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-violet-300/60 disabled:opacity-45"><Sparkles className="mb-3 h-4 w-4 text-violet-300"/><strong className="block text-sm text-white">{id.replace("mission.", "").replaceAll("_", " ")}</strong><span className="mt-1 block text-xs text-slate-400">Why now and expected artifact are recorded with the action.</span></button>)}</div>
      <section className="mt-6 space-y-3" aria-live="polite">{artifacts.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-400">No artifacts yet. Define an objective to choose the smallest valid operation.</div> : artifacts.map((artifact) => <article key={artifact.id} className="rounded-xl border border-white/10 bg-slate-950/55 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-medium text-white"><FileCheck2 className="h-4 w-4 text-cyan-300"/>{artifact.title}</div><span className="text-xs text-slate-400">{artifact.state}</span></div><p className="mt-2 text-sm text-slate-300">{artifact.detail}</p><p className="mt-2 text-xs text-slate-500">Why: {artifact.reason}</p></article>)}</section>
    </main>
    <aside className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"><p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300">Decision dossier</p><div className="mt-4 space-y-4 text-sm text-slate-300"><p><ShieldAlert className="mr-2 inline h-4 w-4 text-amber-300"/>Evidence debt is explicit; no confidence score is shown.</p><p>Next valid operation: investigate, then verify, design, simulate, approve, and hand off.</p><Link className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200" href="/communities">Open Communities <ArrowRight className="h-3.5 w-3.5"/></Link></div></aside>
  </div>;
}
