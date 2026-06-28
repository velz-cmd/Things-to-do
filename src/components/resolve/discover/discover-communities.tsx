"use client";

import { useEffect, useState } from "react";
import { listFeaturedCommunities } from "@/lib/communities/catalog";
import { InstallResolveCard } from "@/components/resolve/communities/install-resolve-card";

type CommunitySummary = {
  slug: string;
  installed: boolean;
};

export function DiscoverCommunities() {
  const featured = listFeaturedCommunities();
  const [installed, setInstalled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void fetch("/api/communities", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { communities: [] }))
      .then((d: { communities?: CommunitySummary[] }) => {
        const map: Record<string, boolean> = {};
        for (const c of d.communities ?? []) {
          map[c.slug] = c.installed;
        }
        setInstalled(map);
      })
      .catch(() => undefined);
  }, []);

  return (
    <section className="mb-12">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
        Attach
      </p>
      <h2 className="mt-2 text-lg font-semibold text-white">Install RESOLVE where communities live</h2>
      <p className="mt-1 max-w-2xl text-sm text-resolve-muted">
        Like analytics for open worlds — connect doctrine, scrobble bridge, and Arc settlement in seconds.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {featured.map((c) => (
          <InstallResolveCard
            key={c.slug}
            community={c}
            installed={installed[c.slug]}
            onInstalled={() => setInstalled((prev) => ({ ...prev, [c.slug]: true }))}
          />
        ))}
      </div>
    </section>
  );
}
