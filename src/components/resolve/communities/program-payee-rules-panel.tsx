"use client";

import clsx from "clsx";
import Link from "next/link";
import { PROGRAM_TEMPLATES } from "@/lib/communities/catalog";
import type { ProgramRecord } from "@/lib/communities/types";
import { EARN_ELIGIBILITY_RULES } from "@/lib/earn/eligibility-copy";
import type { ProgramPoolState } from "@/lib/capital/pool-checkpoint-types";
import { Money } from "@/components/resolve/ui/money";
import { profileConnectPath } from "@/lib/communities/community-nav";
import { useProgramPoolState } from "@/components/resolve/communities/pool-checkpoint-panel";
import { buildPreviewCohortPayees } from "@/lib/discover/preview-cohort-payees";

type ProgramPayeeRulesPanelProps = {
  program: ProgramRecord;
  communitySlug: string;
  pool?: ProgramPoolState | null;
  githubConnected?: boolean;
  githubUsername?: string | null;
  className?: string;
};

function templateDomain(templateId: string): "oss" | "music" | "video" | "research" | null {
  if (templateId.includes("royalt") || templateId.includes("music")) return "music";
  if (templateId.includes("citation") || templateId.includes("research")) return "research";
  if (templateId.includes("video")) return "video";
  if (
    templateId.includes("bounty") ||
    templateId.includes("security") ||
    templateId.includes("docs")
  ) {
    return "oss";
  }
  return null;
}

export function ProgramPayeeRulesPanel({
  program,
  communitySlug,
  pool,
  githubConnected,
  githubUsername,
  className,
}: ProgramPayeeRulesPanelProps) {
  const { pool: fetchedPool } = useProgramPoolState(communitySlug, program.id);
  const resolvedPool = pool ?? fetchedPool;
  const previewBatch =
    !resolvedPool?.nextBatchPayees.length && communitySlug
      ? buildPreviewCohortPayees(communitySlug, resolvedPool?.activeMilestoneUsd ?? 500)
      : [];
  const previewTotal = previewBatch.reduce((s, p) => s + p.owedUsd, 0);
  const template = PROGRAM_TEMPLATES[program.templateId as keyof typeof PROGRAM_TEMPLATES];
  const domain = templateDomain(program.templateId);
  const rules = domain
    ? EARN_ELIGIBILITY_RULES.filter((r) => r.id === domain)
    : EARN_ELIGIBILITY_RULES;

  const perPlay = program.rules.perPlayUsd;
  const perMerge = program.rules.perMergeUsd;
  const perCitation = program.rules.perCitationUsd;
  const customRule =
    perPlay != null
      ? `$${perPlay} per verified play`
      : perMerge != null
        ? `$${perMerge} per qualifying merge`
        : perCitation != null
          ? `$${perCitation} per citation`
          : null;

  return (
    <div
      className={clsx(
        "rounded-xl border border-white/[0.08] bg-black/25 p-4 space-y-3",
        className,
      )}
      data-testid="program-payee-rules"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-resolve-accent">
          Payee rules
        </p>
        <p className="mt-1 text-sm text-white">{program.name}</p>
        <p className="mt-0.5 text-xs text-resolve-muted">
          {template?.description ?? customRule ?? program.templateId}
        </p>
      </div>

      <ul className="space-y-2">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
          >
            <p className="text-xs font-medium text-white">{rule.label}</p>
            <p className="mt-0.5 text-[11px] text-amber-100/90">{rule.threshold}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-resolve-muted-dim">{rule.detail}</p>
          </li>
        ))}
      </ul>

      {domain === "oss" && (
        <div className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-[11px]">
          {githubConnected && githubUsername ? (
            <p className="text-emerald-200">
              GitHub connected as <span className="font-medium text-white">@{githubUsername}</span> —
              eligible OSS work routes to your payee key when authorizations sync.
            </p>
          ) : (
            <p className="text-resolve-muted">
              Connect GitHub in Profile so maintainer activity can match your payee key.{" "}
              <Link href={profileConnectPath(communitySlug)} className="text-resolve-accent hover:underline">
                Connect GitHub →
              </Link>
            </p>
          )}
        </div>
      )}

      {resolvedPool && resolvedPool.nextBatchPayees.length > 0 && (
        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-[10px] uppercase tracking-wider text-resolve-muted">
            Queued for next ${resolvedPool.activeMilestoneUsd.toLocaleString()} batch
          </p>
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
            {resolvedPool.nextBatchPayees.map((payee) => (
              <li
                key={`${payee.payeeKeyType}:${payee.payeeKey}`}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="truncate text-white">{payee.label}</span>
                <Money amount={payee.owedUsd} size="sm" className="shrink-0 text-amber-100" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {previewBatch.length > 0 && (!resolvedPool || resolvedPool.nextBatchPayees.length === 0) && (
        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-[10px] uppercase tracking-wider text-resolve-muted">
            Next $500 batch · eligibility preview · ${previewTotal.toFixed(2)} across{" "}
            {previewBatch.length} creators
          </p>
          <p className="mt-0.5 text-[10px] text-resolve-muted-dim">
            {githubConnected
              ? "GitHub is connected — ledger authorizations replace this preview when activity syncs."
              : "Connect sources in Profile so verified work can queue for payout."}
          </p>
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
            {previewBatch.map((payee) => (
              <li
                key={payee.label}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="truncate text-white/90">{payee.label}</span>
                <Money amount={payee.owedUsd} size="sm" className="shrink-0 text-amber-100/80" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {resolvedPool && resolvedPool.nextBatchPayees.length === 0 && resolvedPool.authorizationCount === 0 && previewBatch.length === 0 && (
        <p className="text-[11px] text-resolve-muted-dim">
          No payees in the ledger yet — connect sources in Profile and run a sensor sync. Rules
          above apply when verified activity arrives.
        </p>
      )}
    </div>
  );
}
