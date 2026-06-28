"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { InstallResolveCard } from "@/components/resolve/communities/install-resolve-card";

type CommunitySummary = {
  slug: string;
  name: string;
  installed: boolean;
};

export function ProfileInstalledCommunities() {
  const catalog = COMMUNITY_CATALOG;
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/communities", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { communities: [] }))
      .then((d: { communities?: CommunitySummary[] }) => {
        setCommunities(d.communities ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const installed = communities.filter((c) => c.installed);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">RESOLVE installations</h2>
          <p className="mt-0.5 text-xs text-resolve-muted">
            Communities where doctrine and settlement are attached
          </p>
        </div>
        <Link
          href="/communities"
          className="inline-flex items-center gap-1 text-xs font-medium text-resolve-accent hover:underline"
        >
          Communities hub
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-resolve-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading installations…
        </div>
      ) : (
        <div className="space-y-3">
          {installed.length > 0 ? (
            installed.map((c) => {
              const meta = catalog.find((f) => f.slug === c.slug);
              if (!meta) return null;
              return (
                <InstallResolveCard
                  key={c.slug}
                  community={meta}
                  installed
                  compact
                />
              );
            })
          ) : (
            catalog.filter((c) => c.featured).slice(0, 2).map((c) => (
              <InstallResolveCard
                key={c.slug}
                community={c}
                installed={false}
                compact
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
