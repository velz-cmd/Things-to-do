"use client";

import Link from "next/link";
import clsx from "clsx";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { CommunityCatalogEntry } from "@/lib/communities/catalog";

const INTENT_COPY: Record<
  string,
  Partial<Record<DiscoverRole | "default", { title: string; detail: string; cta: string; href: string }>>
> = {
  fund: {
    funder: {
      title: "Fund this community",
      detail: "Create or select a program below, then stake Arc USDC to fulfill ledger authorizations.",
      cta: "Jump to programs",
      href: "#programs",
    },
    dao: {
      title: "Fund a grant pool",
      detail: "Deploy quadratic funding or citation toll — treasury fills as authorizations arrive.",
      cta: "Programs",
      href: "#programs",
    },
    default: {
      title: "Fund programs here",
      detail: "Install RESOLVE first if needed, then fund an active program from the Programs section.",
      cta: "Programs",
      href: "#programs",
    },
  },
  install: {
    founder: {
      title: "Run programs beside your stack",
      detail: "Install attaches this community to your account — sensors sync in the background.",
      cta: "Health & sensors",
      href: "#health",
    },
    operator: {
      title: "Connect sensors",
      detail: "Install RESOLVE, then link GitHub, ListenBrainz, or research APIs on Profile.",
      cta: "Sensor health",
      href: "#health",
    },
    default: {
      title: "Attach this community",
      detail: "Install writes to your account — verified gaps rank on Discover when events arrive.",
      cta: "Install below",
      href: "#health",
    },
  },
};

type Props = {
  intent: string | null;
  role: DiscoverRole | null;
  catalog: CommunityCatalogEntry;
  installed: boolean;
};

export function CommunityIntentBanner({ intent, role, catalog, installed }: Props) {
  if (!intent) return null;

  const bucket = INTENT_COPY[intent];
  if (!bucket) return null;

  const copy =
    (role && bucket[role]) ?? bucket.default ?? Object.values(bucket)[0];
  if (!copy) return null;

  return (
    <div
      className={clsx(
        "mb-6 rounded-xl border px-4 py-3",
        intent === "fund"
          ? "border-amber-500/25 bg-amber-500/5"
          : "border-resolve-accent/25 bg-resolve-accent/5",
      )}
    >
      <p className="text-sm font-semibold text-white">{copy.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-resolve-muted">{copy.detail}</p>
      <p className="mt-1 text-[10px] text-resolve-muted-dim">{catalog.name} · {catalog.tagline}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={copy.href}
          className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-white/10"
        >
          {copy.cta} →
        </Link>
        {!installed && intent === "fund" && (
          <span className="self-center text-[10px] text-amber-200/80">Install RESOLVE first (header)</span>
        )}
        <Link
          href={`/discover`}
          className="self-center text-[10px] text-resolve-muted hover:text-resolve-accent"
        >
          Back to Discover
        </Link>
      </div>
    </div>
  );
}
