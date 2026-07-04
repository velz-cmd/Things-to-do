"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Users,
  Wallet,
  Layers,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Button } from "@/components/resolve/ui/button";
import { Money } from "@/components/resolve/ui/money";
import { CommunitySensorPanel } from "@/components/resolve/communities/community-sensor-panel";
import { CommunityBridgePanel } from "@/components/resolve/communities/community-bridge-panel";
import { PROGRAM_TEMPLATES } from "@/lib/communities/catalog";
import type { CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { CommunitySurface, ProgramRecord } from "@/lib/communities/types";
import {
  quickActionsForKind,
  type CommunityQuickActionId,
} from "@/lib/communities/console-quick-actions";
import { profileConnectPath } from "@/lib/communities/community-nav";
import { communityLinkedViaProfile } from "@/lib/discover/community-profile-link";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";

function programRulesLabel(program: ProgramRecord): string {
  const t = PROGRAM_TEMPLATES[program.templateId as keyof typeof PROGRAM_TEMPLATES];
  if (t?.description) return t.description;
  if (program.rules.perPlayUsd) return `$${program.rules.perPlayUsd} per verified play`;
  if (program.rules.perCitationUsd) return `$${program.rules.perCitationUsd} per citation`;
  if (program.rules.perMergeUsd) return `$${program.rules.perMergeUsd} per docs merge`;
  return program.templateId;
}

function programFundLabel(program: ProgramRecord): string {
  if (program.templateId === "docs-bounty") return "Fund Docs Pool";
  if (program.templateId === "security-fund") return "Fund Security Pool";
  if (program.templateId === "citation-toll") return "Fund Citation Pool";
  if (program.templateId === "video-royalties") return "Fund Creator Pool";
  if (program.templateId === "user-centric-royalties") return "Fund Royalty Pool";
  return "Fund Program Pool";
}

function fundingGapLabel(amountUsd: number): string {
  return `Fund $${amountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} gap`;
}

const CONSOLE_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "obligations", label: "Obligations" },
  { id: "programs", label: "Programs" },
  { id: "sources", label: "Sources" },
];

function ProgramCard({
  program,
  slug,
  communityKind,
  onDeploy,
  onFund,
  deploying,
  readiness,
  sourcesConnected,
}: {
  program: ProgramRecord;
  slug: string;
  communityKind: string;
  onDeploy: (id: string) => void;
  onFund: (programId: string, label?: string, amountUsd?: number) => void;
  deploying: string | null;
  readiness?: ProgramRecord["deployReadiness"];
  sourcesConnected?: boolean;
}) {
  const isDeploying = deploying === program.id;
  const canRedeploy = (readiness?.authorizedCount ?? 0) > 0;
  const fundingGapUsd = readiness?.fundingGapUsd ?? 0;
  const needsFunding = fundingGapUsd > 0.01;
  const deployDisabled =
    isDeploying || needsFunding || (program.status === "deployed" && !canRedeploy);
  const deployLabel =
    readiness?.pendingObligationsUsd && readiness.pendingObligationsUsd > 0
      ? `Settle $${readiness.pendingObligationsUsd.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })} on Arc`
      : "Settle on Arc";

  return (
    <div id={`program-${program.id}`}>
    <BlueGlowCard variant="subtle" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-resolve-accent">
            Program
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">{program.name}</h3>
          <p className="mt-1 text-xs text-resolve-muted">{programRulesLabel(program)}</p>
        </div>
        <span
          className={clsx(
            "rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            program.status === "deployed"
              ? "bg-emerald-500/15 text-emerald-300"
              : program.status === "active"
                ? "bg-resolve-accent/15 text-resolve-accent"
                : "bg-white/5 text-resolve-muted",
          )}
        >
          {program.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-resolve-muted">Budget</p>
          <p className="mt-0.5 text-sm font-semibold text-white">
            <Money amount={program.budgetUsd} size="sm" className="inline" />
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-resolve-muted">Authorized</p>
          <p className="mt-0.5 text-sm font-semibold text-white">
            <Money amount={readiness?.authorizedUsd ?? 0} size="sm" className="inline" />
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-resolve-muted">Pending</p>
          <p className="mt-0.5 text-sm font-semibold text-amber-100">
            <Money amount={readiness?.pendingObligationsUsd ?? 0} size="sm" className="inline" />
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            onFund(
              program.id,
              needsFunding ? fundingGapLabel(fundingGapUsd) : programFundLabel(program),
              needsFunding ? Math.max(5, fundingGapUsd) : undefined,
            )
          }
        >
          {needsFunding ? fundingGapLabel(fundingGapUsd) : programFundLabel(program)}
        </Button>
        <Button
          size="sm"
          disabled={deployDisabled || !readiness?.canDeploy}
          onClick={() => onDeploy(program.id)}
        >
          {isDeploying ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Settling on Arc...
            </>
          ) : program.status === "deployed" && !canRedeploy ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Deployed
            </>
          ) : (
            deployLabel
          )}
        </Button>
        <Link
          href={`/mission?community=${slug}&program=${program.missionId ?? program.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-resolve-accent/30 px-3 py-1.5 text-xs text-resolve-accent hover:bg-resolve-accent/10"
        >
          Mission
          <ArrowUpRight className="h-3 w-3" />
        </Link>
        {!sourcesConnected && (
          <Link
            href={profileConnectPath(`/communities/${slug}`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-resolve-muted hover:text-white"
          >
            Connect source
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {readiness?.reasons && readiness.reasons.length > 0 && !readiness.canDeploy && (
        <ul className="space-y-1 text-[11px] text-amber-200/90">
          {readiness.reasons.map((r) => (
            <li key={r}>- {r}</li>
          ))}
        </ul>
      )}
    </BlueGlowCard>
    </div>
  );
}

type Props = {
  slug: string;
  catalog: CommunityCatalogEntry;
  surface: CommunitySurface;
  connections: UserConnectionState;
  busy: boolean;
  deploying: string | null;
  obligationsFilter: "all" | "pending";
  onObligationsFilterChange: (f: "all" | "pending") => void;
  onRequestDeploy: (programId: string) => void;
  onFund: (programId: string, label?: string, amountUsd?: number) => void;
  onRequestCreateProgram: () => void;
  onRequestApprovePayouts: () => void;
  onRefresh: () => void;
};

const PENDING_STATUSES = new Set(["authorized", "pending_funding"]);

export function CommunityConsole({
  slug,
  catalog,
  surface,
  connections,
  busy,
  deploying,
  obligationsFilter,
  onObligationsFilterChange,
  onRequestDeploy,
  onFund,
  onRequestCreateProgram,
  onRequestApprovePayouts,
  onRefresh,
}: Props) {
  const [sensorsOpen, setSensorsOpen] = useState(false);
  const quickActions = quickActionsForKind(catalog.kind);
  const sourcesConnected =
    connections.hasAnyConnector || communityLinkedViaProfile(slug, connections);
  const programCount = surface.programs.length;
  const builderCount = surface.impact?.artistCount ?? 0;
  const pendingUsd = surface.deployReadiness?.pendingObligationsUsd ?? 0;

  const filteredAuthorizations = (surface.authorizations ?? []).filter((a) =>
    obligationsFilter === "pending" ? PENDING_STATUSES.has(a.status) : true,
  );

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function runQuickAction(actionId: CommunityQuickActionId) {
    switch (actionId) {
      case "create_program":
        onRequestCreateProgram();
        break;
      case "connect_source":
        window.location.href = profileConnectPath(`/communities/${slug}`);
        break;
      case "review_obligations":
        onObligationsFilterChange("pending");
        scrollTo("obligations");
        break;
      case "approve_payouts":
        onRequestApprovePayouts();
        break;
    }
  }

  function quickActionDisabled(actionId: CommunityQuickActionId): { disabled: boolean; reason?: string } {
    if (actionId === "create_program" && busy) {
      return { disabled: true, reason: "Creating payout program..." };
    }
    if (actionId === "connect_source" && sourcesConnected) {
      return { disabled: true, reason: "Source linked via Profile" };
    }
    if (
      actionId === "review_obligations" &&
      (surface.authorizations?.length ?? 0) === 0 &&
      pendingUsd < 0.01
    ) {
      return { disabled: true, reason: "No obligations yet - sync sources first" };
    }
    if (actionId === "approve_payouts") {
      const fundingGapUsd = surface.deployReadiness?.fundingGapUsd ?? 0;
      if (!surface.programs.length) {
        return { disabled: true, reason: "Create a payout program before settlement" };
      }
      if (fundingGapUsd > 0.01) {
        return {
          disabled: true,
          reason: `$${fundingGapUsd.toFixed(2)} more funding is required before Arc settlement.`,
        };
      }
      if (pendingUsd < 0.01 && !surface.deployReadiness?.canDeploy) {
        return { disabled: true, reason: "No pending payouts - sync sources for activity" };
      }
    }
    return { disabled: false };
  }

  return (
    <div id="console" className="scroll-mt-24 space-y-8">
      <nav className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.08] bg-[#07111f]/70 p-1">
        {CONSOLE_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => scrollTo(section.id)}
            className="rounded-xl px-3 py-2 text-xs font-medium text-resolve-muted transition hover:bg-white/[0.06] hover:text-white"
          >
            {section.label}
          </button>
        ))}
      </nav>

      <section id="overview" className="grid scroll-mt-24 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BlueGlowCard variant="subtle" className="space-y-1.5">
          <div className="flex items-center gap-2 text-resolve-muted">
            <Wallet className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Treasury</span>
          </div>
          <p className="text-2xl font-semibold text-white">
            <Money amount={surface.health.treasuryUsd} />
          </p>
          <p className="text-[11px] text-resolve-muted">
            Available program funding -{" "}
            <Money amount={surface.health.communityObligationsUsd} size="sm" className="inline" />{" "}
            obligations
          </p>
        </BlueGlowCard>

        <BlueGlowCard variant="subtle" className="space-y-1.5">
          <div className="flex items-center gap-2 text-resolve-muted">
            <Layers className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Programs</span>
          </div>
          <p className="text-2xl font-semibold text-white">{programCount}</p>
          <p className="text-[11px] text-resolve-muted">Active payout pools</p>
        </BlueGlowCard>

        <BlueGlowCard variant="subtle" className="space-y-1.5">
          <div className="flex items-center gap-2 text-resolve-muted">
            <Users className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Builders</span>
          </div>
          <p className="text-2xl font-semibold text-white">{builderCount}</p>
          <p className="text-[11px] text-resolve-muted">Unique payees authorized</p>
        </BlueGlowCard>

        <BlueGlowCard variant="subtle" className="space-y-1.5">
          <div className="flex items-center gap-2 text-amber-200/80">
            <AlertCircle className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Pending</span>
          </div>
          <p className="text-2xl font-semibold text-amber-100">
            <Money amount={pendingUsd} />
          </p>
          <p className="text-[11px] text-resolve-muted">
            {surface.deployReadiness?.authorizedCount ?? 0} payouts waiting for settlement
          </p>
        </BlueGlowCard>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white">Quick actions</h2>
        <p className="mt-1 text-xs text-resolve-muted">
          Manage programs, funding, and payouts using live community proof.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickActions.map((action) => {
            const gate = quickActionDisabled(action.id);
            return (
              <div key={action.id} className="flex max-w-[220px] flex-col gap-1">
                <button
                  type="button"
                  disabled={gate.disabled || busy}
                  title={gate.reason}
                  onClick={() => void runQuickAction(action.id)}
                  className={clsx(
                    "rounded-xl border px-4 py-2.5 text-xs font-medium transition",
                    gate.disabled || busy
                      ? "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-resolve-muted-dim"
                      : "border-resolve-accent/30 bg-resolve-accent/10 text-resolve-accent hover:bg-resolve-accent/15",
                  )}
                >
                  {action.label}
                </button>
                <span className="text-[10px] leading-snug text-resolve-muted-dim">
                  {gate.reason ?? action.description}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section id="obligations" className="scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Obligations</h2>
            <p className="mt-1 text-xs text-resolve-muted">
              Verified activity from sources - fund programs, then settle payouts on Arc.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-white/[0.08] p-0.5">
            {(["all", "pending"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onObligationsFilterChange(f)}
                className={clsx(
                  "rounded-md px-2.5 py-1 text-[10px] font-medium capitalize transition",
                  obligationsFilter === f
                    ? "bg-white/10 text-white"
                    : "text-resolve-muted hover:text-white",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {filteredAuthorizations.length > 0 ? (
          <ul className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
            {filteredAuthorizations.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{a.contextLabel ?? a.payeeKey}</p>
                  <p className="mt-0.5 text-[11px] text-resolve-muted">
                    {a.payeeKey} - {a.status}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Money amount={a.amountUsd} size="sm" className="text-white" />
                  <time className="mt-0.5 block text-[10px] text-resolve-muted-dim">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-resolve-muted">
            {obligationsFilter === "pending"
              ? pendingUsd > 0.01
                ? `$${pendingUsd.toFixed(2)} pending is known. Payee rows are still syncing - refresh metrics in a moment.`
                : "No pending obligations - sync sources or switch to All."
              : "No authorizations yet. Connect sources in Profile and sync sensors below."}
          </p>
        )}
      </section>

      <section id="programs" className="scroll-mt-24">
        <h2 className="text-sm font-semibold text-white">Programs</h2>
        <p className="mt-1 text-xs text-resolve-muted">
          Fund active programs, review verified obligations, and settle payouts on Arc when ready.
        </p>
        {surface.programs.length > 0 ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {surface.programs.map((p) => (
              <ProgramCard
                key={p.id}
                program={p}
                slug={slug}
                communityKind={catalog.kind}
                onDeploy={onRequestDeploy}
                onFund={onFund}
                deploying={deploying}
                readiness={p.deployReadiness ?? surface.deployReadiness}
                sourcesConnected={sourcesConnected}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center">
            <p className="text-sm text-resolve-muted">
              No payout programs yet. Create a draft rule before funding or settlement.
            </p>
            <Button
              size="sm"
              className="mt-3"
              disabled={busy}
              onClick={() => onRequestCreateProgram()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Payout Program"}
            </Button>
          </div>
        )}
      </section>

      <section
        id="sources"
        className="scroll-mt-24 rounded-xl border border-white/[0.08] bg-[#0a0f18]/40"
      >
        <button
          type="button"
          onClick={() => setSensorsOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div>
            <p className="text-sm font-medium text-white">Sensor health</p>
            <p className="text-[11px] text-resolve-muted">Bridge sync and connector status</p>
          </div>
          <ChevronDown
            className={clsx("h-4 w-4 text-resolve-muted transition", sensorsOpen && "rotate-180")}
          />
        </button>
        {sensorsOpen && (
          <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
            <CommunitySensorPanel slug={slug} installed onSynced={onRefresh} />
            <div className="mt-4">
              <CommunityBridgePanel communitySlug={slug} onSynced={onRefresh} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
