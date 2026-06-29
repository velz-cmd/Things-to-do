"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Money } from "@/components/resolve/ui/money";
import { friendlyStatus } from "@/lib/banking/copy";

type PendingRow = {
  id: string;
  missionId: string;
  programName: string;
  communitySlug: string;
  payeeKey: string;
  amountUsd: number;
  status: string;
  connectorId: string;
  entityPath?: string;
  updatedAt: string;
};

type PendingResponse = {
  ok: boolean;
  totalUsd: number;
  count: number;
  authorizations: PendingRow[];
};

type ProgramGroup = {
  programName: string;
  communitySlug: string;
  missionId: string;
  totalUsd: number;
  rows: PendingRow[];
};

export function PendingAuthorizationsPanel({
  signedIn,
  variant = "overview",
}: {
  signedIn: boolean;
  variant?: "overview" | "programs";
}) {
  const [data, setData] = useState<PendingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }

    const load = () =>
      fetch("/api/banking/pending-authorizations", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setData(d))
        .catch(() => setData(null))
        .finally(() => setLoading(false));

    void load();
    const t = setInterval(() => void load(), 25_000);
    return () => clearInterval(t);
  }, [signedIn]);

  const groups = useMemo(() => {
    if (!data?.authorizations?.length) return [] as ProgramGroup[];
    const map = new Map<string, ProgramGroup>();
    for (const row of data.authorizations) {
      const key = row.missionId;
      const existing = map.get(key);
      if (existing) {
        existing.totalUsd += row.amountUsd;
        existing.rows.push(row);
      } else {
        map.set(key, {
          programName: row.programName,
          communitySlug: row.communitySlug,
          missionId: row.missionId,
          totalUsd: row.amountUsd,
          rows: [row],
        });
      }
    }
    return [...map.values()].sort((a, b) => b.totalUsd - a.totalUsd);
  }, [data]);

  if (!signedIn) return null;

  if (loading) {
    return (
      <section className="mb-6 flex items-center gap-2 text-sm text-resolve-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading program obligations…
      </section>
    );
  }

  if (!data?.count) {
    if (variant === "programs") {
      return (
        <section className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/40 px-4 py-4 text-sm text-resolve-muted">
          No pending obligations on your programs. Install a community and connect sensors — value
          appears here automatically.
        </section>
      );
    }
    return null;
  }

  if (variant === "programs") {
    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Pending obligations by program</p>
            <p className="mt-1 text-xs text-resolve-muted">
              Authorized value awaiting funding or deploy — review before moving capital
            </p>
          </div>
          <p className="text-xl font-semibold tabular-nums text-amber-100">
            <Money amount={data.totalUsd} size="lg" className="inline" />
          </p>
        </div>
        <ul className="space-y-3">
          {groups.map((g) => (
            <li
              key={g.missionId}
              className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{g.programName}</p>
                  <p className="text-[11px] text-resolve-muted">
                    {g.communitySlug} · {g.rows.length} authorization(s)
                  </p>
                </div>
                <Money amount={g.totalUsd} size="md" className="text-amber-100" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/communities/${g.communitySlug}`}
                  className="text-xs font-medium text-resolve-accent hover:underline"
                >
                  Open community →
                </Link>
                <Link
                  href="/capital?tab=programs"
                  className="text-xs font-medium text-resolve-accent hover:underline"
                >
                  Fund / fulfill →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Pending on your programs</p>
          <p className="mt-1 text-xs text-resolve-muted">
            Authorized value waiting for deploy or funding
          </p>
        </div>
        <p className="text-lg font-semibold tabular-nums text-amber-100">
          <Money amount={data.totalUsd} size="lg" className="inline" />
        </p>
      </div>

      <ul className="mt-4 divide-y divide-white/[0.06]">
        {data.authorizations.slice(0, 10).map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-white">
                {row.entityPath ? (
                  <Link href={row.entityPath} className="hover:text-resolve-accent hover:underline">
                    {row.payeeKey}
                  </Link>
                ) : (
                  row.payeeKey
                )}
              </p>
              <p className="text-[11px] text-resolve-muted">
                {row.programName} · {row.communitySlug} · {friendlyStatus(row.status)}
              </p>
            </div>
            <Money amount={row.amountUsd} size="sm" className="shrink-0 text-emerald-300" />
          </li>
        ))}
      </ul>

      {data.count > 10 && (
        <p className="mt-2 text-[10px] text-resolve-muted-dim">+{data.count - 10} more</p>
      )}

      <Link
        href="/capital?tab=programs"
        className="mt-3 inline-block text-xs font-medium text-resolve-accent hover:underline"
      >
        Review all obligations →
      </Link>
    </section>
  );
}
