"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Layers, Loader2, Search } from "lucide-react";
import clsx from "clsx";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { InstallResolveCard } from "@/components/resolve/communities/install-resolve-card";

type CommunitySummary = {
  slug: string;
  name: string;
  tagline: string;
  kind: string;
  installed: boolean;
};

const KINDS = ["all", "music", "oss", "research", "protocol"] as const;

/** Communities hub — installed operating rooms + catalog browse */
export function CommunitiesHub() {
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");

  useEffect(() => {
    void fetch("/api/communities", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { communities: [] }))
      .then((d: { communities?: CommunitySummary[] }) => {
        setCommunities(d.communities ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const installedBySlug = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of communities) map[c.slug] = c.installed;
    return map;
  }, [communities]);

  const installed = useMemo(
    () =>
      COMMUNITY_CATALOG.filter((c) => installedBySlug[c.slug]).map((meta) => ({
        meta,
        summary: communities.find((s) => s.slug === meta.slug),
      })),
    [communities, installedBySlug],
  );

  const browse = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMMUNITY_CATALOG.filter((c) => {
      if (kind !== "all" && c.kind !== kind) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q))
      );
    });
  }, [query, kind]);

  return (
    <ProductPage
      icon={Layers}
      title="Communities"
      description="Operate open communities where value already exists — programs, observatory, authorizations, and Arc settlement in one place."
      width="wide"
      accent="emerald"
      workflows={[
        { label: "Observe", href: "/discover" },
        { label: "Operate", active: true },
        { label: "Decide", href: "/mission" },
        { label: "Execute", href: "/capital" },
      ]}
    >
      <section className="mb-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Your operating rooms
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Communities where RESOLVE is installed
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-resolve-muted">
              Doctrine, programs, economic memory, and deploy — permanent operations, not one-off
              missions.
            </p>
          </div>
          <Link
            href="/discover"
            className="inline-flex items-center gap-1 text-xs font-medium text-resolve-accent hover:underline"
          >
            Discover more worlds
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-resolve-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading installations…
          </div>
        ) : installed.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {installed.map(({ meta }) => (
              <BlueGlowCard key={meta.slug} variant="subtle" className="flex flex-col gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
                    {meta.kind}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-white">{meta.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-resolve-muted">{meta.tagline}</p>
                </div>
                <Link
                  href={`/communities/${meta.slug}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
                >
                  Open operating room
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </BlueGlowCard>
            ))}
          </div>
        ) : (
          <BlueGlowCard variant="subtle" className="border-dashed border-white/10">
            <p className="text-sm text-resolve-muted">
              No communities installed yet. Browse below and attach RESOLVE where your ecosystem
              already lives — music servers, OSS, research graphs, and more.
            </p>
          </BlueGlowCard>
        )}
      </section>

      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Browse & install
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">Attach to existing communities</h2>
        <p className="mt-1 max-w-2xl text-sm text-resolve-muted">
          Not a marketplace — install doctrine, RFB programs, and settlement beside upstream tools.
        </p>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-resolve-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search music, OSS, research…"
              className="w-full rounded-xl border border-resolve-border bg-resolve-bg-deep/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={clsx(
                  "rounded-full border px-3 py-1 text-[11px] transition",
                  kind === k
                    ? "border-resolve-accent/40 bg-resolve-accent/10 text-resolve-accent"
                    : "border-resolve-border/60 text-resolve-muted hover:text-white",
                )}
              >
                {k === "all" ? "All" : k}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {browse.map((c) => (
            <InstallResolveCard
              key={c.slug}
              community={c}
              installed={installedBySlug[c.slug]}
              onInstalled={() => {
                setCommunities((prev) => {
                  const existing = prev.find((p) => p.slug === c.slug);
                  if (existing) {
                    return prev.map((p) =>
                      p.slug === c.slug ? { ...p, installed: true } : p,
                    );
                  }
                  return [
                    ...prev,
                    {
                      slug: c.slug,
                      name: c.name,
                      tagline: c.tagline,
                      kind: c.kind,
                      installed: true,
                    },
                  ];
                });
              }}
            />
          ))}
        </div>

        {browse.length === 0 && (
          <p className="mt-6 text-sm text-resolve-muted">No communities match your search.</p>
        )}
      </section>
    </ProductPage>
  );
}
