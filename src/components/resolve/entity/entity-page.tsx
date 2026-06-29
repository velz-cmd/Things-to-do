"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowLeft,
  CircleDollarSign,
  GitBranch,
  Network,
  Scale,
  Users,
} from "lucide-react";
import { EntityActionBar } from "@/components/resolve/entity/entity-action-bar";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Money } from "@/components/resolve/ui/money";
import { ENTITY_KIND_LABELS } from "@/lib/entity/paths";
import type { EntitySurface } from "@/lib/entity/types";

const SECTION_NAV = [
  "overview",
  "value",
  "gap",
  "relationships",
  "people",
  "timeline",
  "payments",
  "evidence",
] as const;

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="mt-1 text-xs text-resolve-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function EntityPage({ initial }: { initial: EntitySurface }) {
  const [surface, setSurface] = useState(initial);

  useEffect(() => {
    const apiPath = `/api/entity${surface.path.replace(/^\/e/, "")}`;
    const interval = setInterval(() => {
      void fetch(apiPath)
        .then((r) => r.json())
        .then((d: EntitySurface) => {
          if (d.ok) setSurface(d);
        })
        .catch(() => null);
    }, 30_000);
    return () => clearInterval(interval);
  }, [surface.path]);

  const kindLabel = ENTITY_KIND_LABELS[surface.kind];

  return (
    <ProductPage
      icon={Network}
      title={surface.label}
      description={surface.subtitle}
      width="wide"
      accent="emerald"
      workflows={SECTION_NAV.map((id) => ({
        label: id.charAt(0).toUpperCase() + id.slice(1),
        href: `#${id}`,
      }))}
      actions={
        <Link
          href="/discover"
          className="inline-flex items-center gap-1.5 text-xs text-resolve-muted transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Discover
        </Link>
      }
    >
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
          {kindLabel}
        </span>
        {surface.live ? (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-resolve-muted">
            Live ledger slice
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-white/15 px-2.5 py-0.5 text-[10px] text-resolve-muted-dim">
            Awaiting sensor data
          </span>
        )}
      </div>

      {!surface.live && surface.emptyReason && (
        <div className="mb-10 rounded-xl border border-dashed border-resolve-border/80 bg-resolve-bg-deep/20 px-5 py-6 text-sm text-resolve-muted">
          {surface.emptyReason}
        </div>
      )}

      <EntityActionBar surface={surface} />

      <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
        <div className="space-y-12">
          <Section id="overview" title="Overview" description="Layer 1 brain + Layer 4 graph anchor">
            <BlueGlowCard variant="subtle" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Type</p>
                  <p className="mt-1 text-sm text-white">{surface.overview.typeLabel}</p>
                </div>
                {surface.overview.sourceConnector && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Source</p>
                    <p className="mt-1 text-sm text-white">{surface.overview.sourceConnector}</p>
                  </div>
                )}
              </div>
              {Object.keys(surface.overview.attributes).length > 0 && (
                <dl className="grid gap-2 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
                  {Object.entries(surface.overview.attributes).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">{k}</dt>
                      <dd className="text-sm text-white">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </BlueGlowCard>
          </Section>

          <Section
            id="value"
            title="Value created"
            description="Recognized value from authorization ledger — not vanity metrics"
          >
            <BlueGlowCard variant="subtle">
              <p className="text-3xl font-semibold tabular-nums text-emerald-300">
                <Money amount={surface.valueCreated.totalUsd} size="lg" />
              </p>
              <p className="mt-2 text-xs text-resolve-muted">{surface.valueCreated.evidence}</p>
              <p className="mt-1 text-[11px] text-resolve-muted-dim">
                {surface.valueCreated.eventCount} events in slice
              </p>
            </BlueGlowCard>
          </Section>

          <Section id="gap" title="Funding gap" description="Where capital is missing vs. value created">
            <BlueGlowCard variant="subtle">
              <p className="text-2xl font-semibold tabular-nums text-white">
                {surface.fundingGap.gapUsd > 0 ? (
                  <Money amount={surface.fundingGap.gapUsd} size="lg" />
                ) : (
                  "—"
                )}
              </p>
              <p className="mt-2 text-sm text-white/90">{surface.fundingGap.headline}</p>
              <p className="mt-2 text-xs text-resolve-muted">{surface.fundingGap.evidence}</p>
            </BlueGlowCard>
          </Section>

          <Section id="relationships" title="Relationships" description="Value graph edges involving this entity">
            {surface.relationships.length === 0 ? (
              <p className="text-sm text-resolve-muted">No relationships materialized yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
                {surface.relationships.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-resolve-muted-dim">{r.type}</p>
                      <Link href={r.targetPath} className="text-sm font-medium text-resolve-accent hover:underline">
                        {r.targetLabel}
                      </Link>
                      <p className="mt-1 text-[11px] text-resolve-muted-dim">{r.evidence}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="people" title="People" description="Contributors and maintainers linked to this entity">
            {surface.people.length === 0 ? (
              <p className="text-sm text-resolve-muted">No people linked from sensors yet.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {surface.people.map((p) => (
                  <li key={p.id}>
                    <Link href={p.path}>
                      <BlueGlowCard variant="subtle" className="transition-colors hover:border-resolve-accent/30">
                        <div className="flex items-start gap-2">
                          <Users className="mt-0.5 h-4 w-4 shrink-0 text-resolve-accent" />
                          <div>
                            <p className="text-sm font-medium text-white">{p.label}</p>
                            <p className="text-[11px] text-resolve-muted">{p.role}</p>
                            <p className="mt-1 text-[10px] text-resolve-muted-dim">{p.evidence}</p>
                          </div>
                        </div>
                      </BlueGlowCard>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="timeline" title="Timeline" description="Authorization events in chronological order">
            {surface.timeline.length === 0 ? (
              <p className="text-sm text-resolve-muted">No timeline events yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
                {surface.timeline.map((t) => (
                  <li key={t.id} className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{t.title}</p>
                    <p className="text-xs text-resolve-muted">{t.detail}</p>
                    <p className="mt-1 text-[10px] text-resolve-muted-dim">{t.evidence}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="payments" title="Payments" description="Authorization ledger rows for this entity">
            {surface.payments.length === 0 ? (
              <p className="text-sm text-resolve-muted">No payment authorizations yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
                {surface.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{p.contextLabel ?? p.connectorId}</p>
                      <p className="text-[11px] text-resolve-muted">{p.status.replace(/_/g, " ")}</p>
                      <p className="mt-0.5 text-[10px] text-resolve-muted-dim">{p.evidence}</p>
                    </div>
                    <Money amount={p.amountUsd} size="sm" className="shrink-0 text-emerald-300" />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="evidence" title="Evidence" description="Proof refs backing recognition">
            {surface.evidence.length === 0 ? (
              <p className="text-sm text-resolve-muted">Evidence populates when sensors write proof hashes.</p>
            ) : (
              <ul className="space-y-2">
                {surface.evidence.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs"
                  >
                    <p className="font-medium text-white">{e.label}</p>
                    <p className="mt-1 font-mono text-[11px] text-resolve-muted">{e.detail}</p>
                    <p className="mt-1 text-resolve-muted-dim">{e.source}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <BlueGlowCard variant="subtle" className="space-y-3">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-emerald-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
                Conservation flow
              </p>
            </div>
            <p className="text-xs leading-relaxed text-resolve-muted">
              {surface.economics.conservation.evidence}
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <p className="text-resolve-muted-dim">Inflows</p>
                <p className="tabular-nums text-white">${surface.economics.conservation.inflowsUsd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-resolve-muted-dim">Treasury</p>
                <p className="tabular-nums text-white">${surface.economics.conservation.treasuryUsd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-resolve-muted-dim">Settled</p>
                <p className="tabular-nums text-white">${surface.economics.conservation.settledUsd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-resolve-muted-dim">Pending</p>
                <p className="tabular-nums text-white">${surface.economics.conservation.pendingUsd.toFixed(2)}</p>
              </div>
            </div>
            <p
              className={clsx(
                "text-[10px] font-medium",
                surface.economics.conservation.balanced ? "text-emerald-400" : "text-amber-400",
              )}
            >
              {surface.economics.conservation.balanced ? "Balanced" : `Residual $${surface.economics.conservation.residualUsd.toFixed(2)}`}
            </p>
          </BlueGlowCard>

          <BlueGlowCard variant="subtle" className="space-y-2">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-resolve-accent" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
                Gini coefficient
              </p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-white">
              {surface.economics.gini.coefficient.toFixed(2)}
            </p>
            <p className="text-xs text-resolve-muted">{surface.economics.gini.evidence}</p>
          </BlueGlowCard>

          {surface.economics.hIndex && (
            <BlueGlowCard variant="subtle" className="space-y-2">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-resolve-accent" />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
                  H-index style
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-white">
                {surface.economics.hIndex.hIndex}
              </p>
              <p className="text-xs text-resolve-muted">{surface.economics.hIndex.evidence}</p>
            </BlueGlowCard>
          )}

          {surface.graph.nodes.length > 0 && (
            <BlueGlowCard variant="subtle" className="overflow-hidden p-2">
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
                Local graph
              </p>
              <svg viewBox="0 0 400 280" className="h-auto w-full" aria-hidden>
                {surface.graph.edges.map((e) => {
                  const from = surface.graph.nodes.find((n) => n.id === e.from);
                  const to = surface.graph.nodes.find((n) => n.id === e.to);
                  if (!from?.x || !to?.x || from.y == null || to.y == null) return null;
                  return (
                    <line
                      key={e.id}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="rgba(96,165,250,0.25)"
                      strokeWidth={1}
                    />
                  );
                })}
                {surface.graph.nodes.map((n) =>
                  n.x != null && n.y != null ? (
                    <circle
                      key={n.id}
                      cx={n.x}
                      cy={n.y}
                      r={n.id === surface.id ? 8 : 5}
                      fill={n.id === surface.id ? "#34d399" : "#60a5fa"}
                      fillOpacity={0.85}
                    />
                  ) : null,
                )}
              </svg>
            </BlueGlowCard>
          )}
        </aside>
      </div>
    </ProductPage>
  );
}
