"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  GitCompareArrows,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import type { ResolveResponseCard } from "@/lib/mission/structured-contract";

function DecisionCard({ card }: { card: Extract<ResolveResponseCard, { type: "decision_summary" }> }) {
  return (
    <article className="rounded-xl border border-violet-300/15 bg-violet-300/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-semibold text-white">{card.title}</h3>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-300">
          {card.confidenceLabel.replaceAll("-", " ")}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-white">{card.recommendation}</p>
      {card.reasons.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">
          {card.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      )}
    </article>
  );
}

function EvidenceCard({ card }: { card: Extract<ResolveResponseCard, { type: "evidence_summary" }> }) {
  return (
    <article className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4">
      <div className="flex items-center gap-2">
        <FileCheck2 className="h-4 w-4 text-cyan-300" />
        <h3 className="text-sm font-semibold text-white">{card.title}</h3>
      </div>
      <div className="mt-3 flex gap-5 text-xs text-slate-300">
        <span>{card.collected} collected</span>
        <span>{card.verified} verified sources</span>
      </div>
      {card.references.length > 0 && (
        <ul className="mt-3 space-y-2">
          {card.references.map((reference) => (
            <li key={reference.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-slate-950/50 px-3 py-2 text-xs">
              <span className="min-w-0 truncate text-slate-200">{reference.label}</span>
              {reference.sourceUrl && (
                <a className="shrink-0 text-violet-300 hover:text-violet-200" href={reference.sourceUrl} target="_blank" rel="noreferrer">
                  Source <ArrowUpRight className="ml-1 inline h-3 w-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {card.missing.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs text-amber-100">
          <p className="font-medium">Missing evidence</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {card.missing.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}
    </article>
  );
}

function ClaimCard({ card }: { card: Extract<ResolveResponseCard, { type: "claim_verification" }> }) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{card.title}</h3>
        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${
          card.verdict === "supported" ? "bg-emerald-400/10 text-emerald-300"
          : card.verdict === "contradicted" ? "bg-rose-400/10 text-rose-300"
          : "bg-amber-400/10 text-amber-200"
        }`}>{card.verdict}</span>
      </div>
      <p className="mt-3 text-sm text-slate-200">{card.claim}</p>
      {card.supportingEvidence.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-300">
          {card.supportingEvidence.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
      {card.missingEvidence.length > 0 && (
        <p className="mt-3 text-xs text-amber-200">{card.missingEvidence.join(" ")}</p>
      )}
    </article>
  );
}

function ComparisonCard({ card }: { card: Extract<ResolveResponseCard, { type: "comparison" }> }) {
  return (
    <article className="rounded-xl border border-violet-300/15 bg-violet-300/[0.035] p-4">
      <div className="flex items-center gap-2">
        <GitCompareArrows className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-semibold text-white">{card.title}</h3>
      </div>
      <p className="mt-2 text-xs text-slate-400">Criteria: {card.criteria.join(", ")}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {card.options.map((option) => (
          <div key={option.label} className={`rounded-lg border p-3 ${
            option.label === card.recommendedOption
              ? "border-violet-300/40 bg-violet-300/[0.07]"
              : "border-white/8 bg-slate-950/45"
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-white">{option.label}</span>
              <span className="text-xs text-slate-300">{option.score}/100</span>
            </div>
            {option.findings.slice(0, 3).map((finding) => (
              <p key={finding} className="mt-2 text-xs leading-5 text-slate-300">{finding}</p>
            ))}
            {option.missingEvidence.map((missing) => (
              <p key={missing} className="mt-2 text-xs text-amber-200">{missing}</p>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-300">
        {card.recommendedOption ? `Recommended: ${card.recommendedOption}. ` : ""}
        {card.reasons.join(" ")}
      </p>
    </article>
  );
}

function SimulationCard({ card }: { card: Extract<ResolveResponseCard, { type: "simulation" }> }) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center gap-2">
        <Waypoints className="h-4 w-4 text-sky-300" />
        <h3 className="text-sm font-semibold text-white">{card.title}</h3>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {card.outcomes.map((outcome) => (
          <div key={outcome.label} className="rounded-lg border border-white/8 bg-slate-950/45 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{outcome.label}</p>
            <p className={`mt-1 text-sm font-medium ${
              outcome.status === "pass" ? "text-emerald-300"
              : outcome.status === "warn" ? "text-amber-200"
              : "text-rose-300"
            }`}>{outcome.value}</p>
          </div>
        ))}
      </div>
      {card.blockers.map((blocker) => (
        <p key={blocker} className="mt-3 text-xs text-amber-200">{blocker}</p>
      ))}
    </article>
  );
}

function BlueprintCard({ card }: { card: Extract<ResolveResponseCard, { type: "blueprint" }> }) {
  return (
    <article className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <h3 className="text-sm font-semibold text-white">{card.title}</h3>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-300">v{card.version} · {card.status.replace("_", " ")}</span>
      </div>
      <p className="mt-3 text-sm text-slate-200">{card.decision}</p>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
        <span>{card.evidenceCount} evidence references</span>
        <span title={card.contentHash}>Proof {card.contentHash.slice(0, 12)}</span>
      </div>
    </article>
  );
}

function HandoffCard({ card }: { card: Extract<ResolveResponseCard, { type: "handoff" }> }) {
  return (
    <article className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        <h3 className="text-sm font-semibold text-white">{card.title}</h3>
      </div>
      <p className="mt-2 text-xs text-slate-300">Receipt {card.receiptId}</p>
      <a href={card.targetRoute} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-violet-300 hover:text-violet-200">
        Open {card.destination === "capital" ? "Capital review" : "Communities"} <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}

export function MissionResponseCards({ cards }: { cards: ResolveResponseCard[] }) {
  return (
    <div className="space-y-3">
      {cards.map((card) => {
        if (card.type === "decision_summary") return <DecisionCard key={card.id} card={card} />;
        if (card.type === "evidence_summary") return <EvidenceCard key={card.id} card={card} />;
        if (card.type === "claim_verification") return <ClaimCard key={card.id} card={card} />;
        if (card.type === "comparison") return <ComparisonCard key={card.id} card={card} />;
        if (card.type === "simulation") return <SimulationCard key={card.id} card={card} />;
        if (card.type === "blueprint") return <BlueprintCard key={card.id} card={card} />;
        if (card.type === "handoff") return <HandoffCard key={card.id} card={card} />;
        if (card.type === "missing_information") {
          return (
            <article key={card.id} className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-200" />
                <h3 className="text-sm font-semibold text-white">{card.title}</h3>
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-100">
                {card.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="mt-3 text-xs text-slate-400">{card.recovery}</p>
            </article>
          );
        }
        if (card.type === "integration_required") {
          return (
            <article key={card.id} className="rounded-xl border border-violet-300/20 bg-violet-300/[0.04] p-4">
              <h3 className="text-sm font-semibold text-white">{card.title}</h3>
              <p className="mt-2 text-xs text-slate-300">{card.reason}</p>
              <a href={card.targetRoute} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-violet-300 hover:text-violet-200">
                Manage GitHub access <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </article>
          );
        }
        if (card.type === "operation_failure") {
          return (
            <article key={card.id} className="rounded-xl border border-rose-300/20 bg-rose-300/[0.04] p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-300" />
                <h3 className="text-sm font-semibold text-white">{card.title}</h3>
              </div>
              <p className="mt-2 text-xs text-rose-100">{card.message}</p>
            </article>
          );
        }
        return null;
      })}
    </div>
  );
}
