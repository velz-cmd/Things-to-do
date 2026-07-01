"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plug, Terminal } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Button } from "@/components/resolve/ui/button";
import { CommunityVitalsRow } from "@/components/resolve/communities/community-vitals-row";
import type { CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { CommunityVitalsSummary } from "@/lib/communities/types";

type InstallResolveCardProps = {
  community: Pick<
    CommunityCatalogEntry,
    "slug" | "name" | "tagline" | "installCta" | "accent" | "attachShape" | "upstream"
  >;
  installed?: boolean;
  vitals?: CommunityVitalsSummary | null;
  compact?: boolean;
  onInstalled?: (observeNarrative?: string) => void;
};

const accentRing: Record<string, string> = {
  violet: "from-violet-500/20 to-resolve-accent/10",
  emerald: "from-emerald-500/20 to-teal-500/10",
  blue: "from-blue-500/20 to-resolve-accent/10",
  orange: "from-orange-500/20 to-amber-500/10",
};

const consoleHref = (slug: string) => `/communities/${slug}#health`;

export function InstallResolveCard({
  community,
  installed = false,
  vitals = null,
  compact = false,
  onInstalled,
}: InstallResolveCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [observeNarrative, setObserveNarrative] = useState<string | null>(null);
  const showInstalled = installed || Boolean(observeNarrative);

  async function install() {
    setBusy(true);
    try {
      const res = await fetch(`/api/communities/${community.slug}/install`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Install failed");

      const narrative =
        data.observeNarrative ??
        vitals?.observeNarrative ??
        `RESOLVE will now observe upstream signals for ${community.name}.`;

      setObserveNarrative(narrative);
      toast.success(
        data.alreadyInstalled
          ? `Already connected to ${community.name}`
          : `Connected to ${community.name}`,
        { description: narrative },
      );
      onInstalled?.(narrative);
      router.push(consoleHref(community.slug));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not install RESOLVE");
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <div className="space-y-2 rounded-xl border border-white/[0.08] bg-[#0a0f18]/60 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{community.name}</p>
            <p className="truncate text-xs text-resolve-muted">{community.tagline}</p>
          </div>
          {showInstalled ? (
            <Link
              href={consoleHref(community.slug)}
              className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-400"
            >
              <Terminal className="h-3.5 w-3.5" />
              Open console
            </Link>
          ) : (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void install()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Install"}
            </Button>
          )}
        </div>
        {vitals && <CommunityVitalsRow vitals={vitals} compact />}
      </div>
    );
  }

  return (
    <BlueGlowCard className="relative overflow-hidden" hover>
      <div
        aria-hidden
        className={clsx(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-50",
          accentRing[community.accent] ?? accentRing.violet,
        )}
      />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl resolve-accent-gradient shadow-resolve-glow">
            {showInstalled ? (
              <CheckCircle2 className="h-5 w-5 text-white" />
            ) : (
              <Plug className="h-5 w-5 text-white" />
            )}
          </div>
          <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-resolve-muted">
            {community.attachShape}
          </span>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white">{community.name}</h3>
          <p className="mt-1 text-sm text-resolve-muted">{community.tagline}</p>
          <p className="mt-2 text-[11px] text-resolve-muted-dim">via {community.upstream}</p>
        </div>

        {vitals && <CommunityVitalsRow vitals={vitals} />}

        {showInstalled && (observeNarrative ?? vitals?.observeNarrative) && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
              Observing
            </p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
              {observeNarrative ?? vitals?.observeNarrative}
            </p>
          </div>
        )}

        {showInstalled ? (
          <Link
            href={consoleHref(community.slug)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/15"
          >
            <Terminal className="h-4 w-4" />
            Open console
          </Link>
        ) : (
          <Button className="w-full" disabled={busy} onClick={() => void install()}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting…
              </>
            ) : (
              community.installCta
            )}
          </Button>
        )}
      </div>
    </BlueGlowCard>
  );
}
