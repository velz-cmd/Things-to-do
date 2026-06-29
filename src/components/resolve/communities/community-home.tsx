"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Music2,
  Radio,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Button } from "@/components/resolve/ui/button";
import { Money } from "@/components/resolve/ui/money";
import { CapitalFlowImpact } from "@/components/resolve/communities/capital-flow-impact";
import { CommunityObservatory } from "@/components/resolve/communities/community-observatory";
import { EconomicMemoryTimeline } from "@/components/resolve/communities/economic-memory-timeline";
import { MeasureLearnPanel } from "@/components/resolve/communities/measure-learn-panel";
import { CommunitySensorPanel } from "@/components/resolve/communities/community-sensor-panel";
import { InstallResolveCard } from "@/components/resolve/communities/install-resolve-card";
import { PROGRAM_TEMPLATES } from "@/lib/communities/catalog";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import type { CommunitySurface, ProgramRecord } from "@/lib/communities/types";

function HealthPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-white/10 bg-white/[0.03] text-resolve-muted",
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-400" : "bg-resolve-muted-dim")} />
      {label}
    </span>
  );
}

function programRulesLabel(program: ProgramRecord): string {
  const t = PROGRAM_TEMPLATES[program.templateId as keyof typeof PROGRAM_TEMPLATES];
  if (t?.description) return t.description;
  if (program.rules.perPlayUsd) return `$${program.rules.perPlayUsd} per verified play`;
  if (program.rules.perCitationUsd) return `$${program.rules.perCitationUsd} per citation`;
  if (program.rules.perMergeUsd) return `$${program.rules.perMergeUsd} per docs merge`;
  return program.templateId;
}

function connectorLink(slug: string, kind: string): { href: string; label: string } {
  if (kind === "music") {
    return { href: "/settings", label: "Connect sensors" };
  }
  if (kind === "research") {
    return { href: "/settings", label: "Connect research APIs" };
  }
  return { href: "/settings", label: "Connect GitHub sensor" };
}

function ProgramCard({
  program,
  slug,
  communityKind,
  onDeploy,
  deploying,
  readiness,
}: {
  program: ProgramRecord;
  slug: string;
  communityKind: string;
  onDeploy: (id: string) => void;
  deploying: string | null;
  readiness?: CommunitySurface["deployReadiness"];
}) {
  const isDeploying = deploying === program.id;
  const canRedeploy = (readiness?.authorizedCount ?? 0) > 0;
  const deployDisabled = isDeploying || (program.status === "deployed" && !canRedeploy);

  return (
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
          <p className="text-[10px] uppercase tracking-wider text-resolve-muted">Rules</p>
          <p className="mt-0.5 text-sm font-semibold text-white truncate">
            {program.rules.connectorId ?? "arc"}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-resolve-muted">Authorized</p>
          <p className="mt-0.5 text-sm font-semibold text-white">
            <Money amount={readiness?.authorizedUsd ?? 0} size="sm" className="inline" />
          </p>
          {(readiness?.authorizedCount ?? 0) > 0 && (
            <p className="text-[9px] text-resolve-muted-dim">
              {readiness?.authorizedCount} events
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={deployDisabled || !readiness?.canDeploy}
          onClick={() => onDeploy(program.id)}
        >
          {isDeploying ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Deploying on Arc…
            </>
          ) : program.status === "deployed" && !canRedeploy ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Deployed
            </>
          ) : program.status === "deployed" && canRedeploy ? (
            "Deploy batch on Arc"
          ) : (
            "Deploy on Arc"
          )}
        </Button>
        <Link
          href={connectorLink(slug, communityKind).href}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-resolve-muted hover:text-white"
        >
          {connectorLink(slug, communityKind).label}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
        <Link
          href={`/mission?community=${slug}&program=${program.missionId ?? program.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-resolve-accent/30 px-3 py-1.5 text-xs text-resolve-accent hover:bg-resolve-accent/10"
        >
          Open in Mission
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {readiness?.reasons && readiness.reasons.length > 0 && (
        <ul className="space-y-1 text-[11px] text-amber-200/90">
          {readiness.reasons.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      )}

      {program.missionId && (
        <p className="text-[10px] text-resolve-muted-dim font-mono">
          Bridge env: NAVIDROME_PROGRAM_MISSION_ID={program.missionId}
        </p>
      )}
    </BlueGlowCard>
  );
}

export function CommunityHome({ slug }: { slug: string }) {
  const catalog = getCommunityBySlug(slug);
  const [surface, setSurface] = useState<CommunitySurface | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/communities/${slug}`, { credentials: "include" });
    const data = await res.json();
    if (res.ok) setSurface(data.community);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function deploy(programId: string) {
    setDeploying(programId);
    try {
      const res = await fetch(`/api/communities/${slug}/programs/${programId}/deploy`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Deploy failed");
      toast.success(data.message);
      if (data.community) setSurface(data.community);
      else await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deploy failed");
    } finally {
      setDeploying(null);
    }
  }

  if (!catalog) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-resolve-muted">Community not found</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-resolve-accent" />
        <p className="mt-3 text-sm text-resolve-muted">Entering {catalog.name}…</p>
      </div>
    );
  }

  const installed = surface?.installed ?? false;

  return (
    <ProductPage
      icon={Music2}
      title={catalog.name}
      description={catalog.tagline}
      workflows={[
        { label: "Health", href: "#health", active: true },
        { label: "Treasury", href: "#treasury" },
        { label: "Events", href: "#events" },
        { label: "Programs", href: "#programs" },
      ]}
      width="wide"
      accent="emerald"
      actions={
        !installed ? (
          <InstallResolveCard community={catalog} installed={false} compact />
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            RESOLVE connected
          </span>
        )
      }
    >
      {!installed ? (
        <div className="max-w-lg space-y-6">
          <InstallResolveCard community={catalog} onInstalled={() => void refresh()} />
          <CommunitySensorPanel slug={slug} installed={false} />
        </div>
      ) : (
        <div className="space-y-8">
          <section id="treasury" className="grid gap-4 md:grid-cols-3 scroll-mt-24">
            <BlueGlowCard variant="subtle" className="space-y-2">
              <div className="flex items-center gap-2 text-resolve-muted">
                <Wallet className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Treasury</span>
              </div>
              <p className="text-2xl font-semibold text-white">
                <Money amount={surface?.health.treasuryUsd ?? 0} />
              </p>
              <p className="text-xs text-resolve-muted">
                <Money amount={surface?.health.communityObligationsUsd ?? 0} size="sm" className="inline" />{" "}
                community obligations
              </p>
            </BlueGlowCard>

            <BlueGlowCard variant="subtle" className="space-y-2">
              <div className="flex items-center gap-2 text-resolve-muted">
                <Activity className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Health</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {surface?.health.connectorStatus.map((c) => (
                  <HealthPill key={c.id} label={c.label} ok={c.health === "healthy"} />
                ))}
                <HealthPill label="Scrobble bridge" ok={surface?.health.scrobbleBridge ?? false} />
              </div>
            </BlueGlowCard>

            <BlueGlowCard variant="subtle" className="space-y-2">
              <div className="flex items-center gap-2 text-resolve-muted">
                <Radio className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Doctrine</span>
              </div>
              <p className="text-sm leading-relaxed text-white/90">{catalog.doctrine}</p>
            </BlueGlowCard>
          </section>

          <div id="health" className="scroll-mt-24">
            <CommunitySensorPanel slug={slug} installed onSynced={refresh} />
          </div>

          {surface?.observatory && surface.observatory.length > 0 && (
            <CommunityObservatory alerts={surface.observatory} />
          )}

          {surface?.impact && <CapitalFlowImpact impact={surface.impact} />}

          {surface?.authorizations && surface.authorizations.length > 0 && (
            <section id="events" className="scroll-mt-24">
              <h2 className="text-sm font-semibold text-white">Recent authorizations</h2>
              <p className="mt-1 text-xs text-resolve-muted">Plays → owed — live from ledger</p>
              <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
                {surface.authorizations.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <div className="min-w-0">
                      {a.entityPath ? (
                        <Link
                          href={a.entityPath}
                          className="truncate text-sm text-resolve-accent hover:underline"
                        >
                          {a.payeeKey}
                        </Link>
                      ) : (
                        <p className="truncate text-sm text-white">{a.payeeKey}</p>
                      )}
                      <p className="text-[11px] text-resolve-muted">{a.status}</p>
                    </div>
                    <Money amount={a.amountUsd} size="sm" className="shrink-0 text-emerald-300" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section id="programs" className="scroll-mt-24">
            <h2 className="text-sm font-semibold text-white">Programs</h2>
            <p className="mt-1 text-xs text-resolve-muted">
              Founders operate programs — budget, rules, recipients, deploy.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {(surface?.programs ?? []).map((p) => (
                <ProgramCard
                  key={p.id}
                  program={p}
                  slug={slug}
                  communityKind={catalog.kind}
                  onDeploy={(id) => void deploy(id)}
                  deploying={deploying}
                  readiness={surface?.deployReadiness}
                />
              ))}
            </div>
          </section>

          {(surface?.programs ?? []).map((p) => (
            <MeasureLearnPanel
              key={`ml-${p.id}`}
              slug={slug}
              programId={p.id}
              onUpdated={() => void refresh()}
            />
          ))}

          <EconomicMemoryTimeline entries={surface?.economicMemory ?? []} />

          {surface?.timeline && surface.timeline.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white">Community history</h2>
              <p className="mt-1 text-xs text-resolve-muted">Installs, authorizations, Arc receipts</p>
              <ul className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
                {surface.timeline.slice(0, 8).map((ev) => (
                  <li key={ev.id} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="text-sm text-white">{ev.title}</p>
                      {ev.detail && (
                        <p className="mt-0.5 text-xs text-resolve-muted">{ev.detail}</p>
                      )}
                    </div>
                    <time className="shrink-0 text-[10px] text-resolve-muted-dim">
                      {new Date(ev.createdAt).toLocaleDateString()}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </ProductPage>
  );
}
