"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Radar } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import type { HiddenBuilder } from "@/lib/weight/types";

export default function DiscoverPage() {
  const [builders, setBuilders] = useState<HiddenBuilder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/discover/builders")
      .then((r) => r.json())
      .then((d) => setBuilders(d.builders ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
          Discovery engine
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Hidden builders</h1>
        <p className="mt-2 max-w-2xl text-sm text-resolve-muted">
          RESOLVE finds unpaid value before anyone else sees it — maintainers with zero funding,
          artists with thousands of scrobbles, creators driving engagement with no campaign.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-resolve-muted">Scanning communities…</p>
      ) : (
        <ul className="space-y-3">
          {builders.map((b) => (
            <li key={b.id}>
              <Panel className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{b.name}</p>
                      <span className="rounded bg-resolve-hover px-1.5 py-0.5 text-[10px] text-resolve-muted">
                        {b.platform}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-blue-200">{b.headline}</p>
                    <p className="mt-1 text-xs text-resolve-muted">{b.role} · {b.handle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tabular-nums text-white">{b.impactScore}</p>
                    <p className="text-[10px] text-resolve-muted">Impact score</p>
                    <p className="mt-1 text-xs text-amber-300/90">
                      ~${b.unpaidUsdEstimate.toLocaleString()} unpaid
                    </p>
                  </div>
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {b.signals.map((s) => (
                    <li
                      key={s.label}
                      className="rounded border border-resolve-border bg-resolve-bg/60 px-2 py-1.5 text-[11px]"
                    >
                      <span className="text-resolve-muted">{s.label}</span>
                      <p className="font-medium text-white">{s.value}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/missions?panel=distribute&builder=${b.id}`}
                    className="inline-flex items-center gap-1 rounded-md bg-resolve-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                  >
                    Fund with weighted split
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link
                    href="/methodology"
                    className="inline-flex items-center gap-1 rounded-md border border-resolve-border px-3 py-1.5 text-xs text-resolve-muted hover:text-white"
                  >
                    How scores work
                  </Link>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-resolve-accent" />
          <p className="text-sm text-resolve-muted">
            Live connector scan for Gmail subscriptions and spend leaks
          </p>
        </div>
        <Link href="/radar" className="text-xs text-resolve-accent hover:underline">
          Open radar →
        </Link>
      </Panel>
    </div>
  );
}
