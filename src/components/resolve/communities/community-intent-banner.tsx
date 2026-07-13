"use client";

import Link from "next/link";
import clsx from "clsx";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { CommunityIntent } from "@/lib/communities/community-nav";

type IntentCopy = { title: string; detail: string; cta: string };

const INTENT_COPY: Record<CommunityIntent, Partial<Record<DiscoverRole | "default", IntentCopy>>> = {
  fund: {
    funder: {
      title: "Capital requirement detected",
      detail: "Review the program and recognized obligations here, then add the required capital in Capital.",
      cta: "Open Capital",
    },
    dao: {
      title: "Capital handoff requested",
      detail: "Communities prepares program state; Capital manages the funding requirement and authorization.",
      cta: "Open Capital",
    },
    default: {
      title: "Capital requirement detected",
      detail: "Review operational readiness here, then complete the funding action in Capital.",
      cta: "Open Capital",
    },
  },
  install: {
    founder: {
      title: "Run programs beside your stack",
      detail: "RESOLVE is attached—synchronize evidence and configure the first operating policy.",
      cta: "Open console",
    },
    operator: {
      title: "Connect evidence sources",
      detail: "Link GitHub, ListenBrainz, or research sources in Profile; synchronized activity returns here.",
      cta: "Open console",
    },
    default: {
      title: "Ecosystem installation received",
      detail: "Connect its evidence sources, resolve observed identities, and configure program policy.",
      cta: "Open console",
    },
  },
  create_program: {
    founder: {
      title: "Create an operating program",
      detail: "Programs define evidence, eligibility, and recognition rules before obligations are prepared for settlement.",
      cta: "Programs",
    },
    default: {
      title: "Program handoff received",
      detail: "Review the policy below and connect its evidence sources before recognizing obligations.",
      cta: "Programs",
    },
  },
  review_obligations: {
    operator: {
      title: "Review recognized obligations",
      detail: "Authorizations from synchronized sources appear below for identity and policy review.",
      cta: "Obligations",
    },
    default: {
      title: "Review obligations",
      detail: "Ledger authorizations waiting for identity, policy, simulation, or capital review.",
      cta: "Obligations",
    },
  },
  approve_payouts: {
    funder: {
      title: "Settlement review requested",
      detail: "Confirm operational readiness here, then authorize the prepared settlement in Capital.",
      cta: "Open Capital",
    },
    default: {
      title: "Settlement review requested",
      detail: "Review identities, policy, and obligations here before handing authorization to Capital.",
      cta: "Open Capital",
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
  const bucket = INTENT_COPY[intent as CommunityIntent];
  if (!bucket) return null;
  const copy = (role && bucket[role]) ?? bucket.default ?? Object.values(bucket)[0];
  if (!copy) return null;
  const opensCapital = intent === "fund" || intent === "approve_payouts";

  return (
    <aside
      className={clsx(
        "mb-4 rounded-xl border px-4 py-3",
        opensCapital ? "border-amber-500/25 bg-amber-500/5" : "border-cyan-400/20 bg-cyan-400/[0.04]",
      )}
    >
      <p className="text-sm font-semibold text-white">{copy.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-resolve-muted">{copy.detail}</p>
      <p className="mt-1 text-[10px] text-resolve-muted-dim">{catalog.name} · {catalog.upstream}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {opensCapital ? (
          <Link href={`/capital?community=${encodeURIComponent(catalog.slug)}`} className="rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-1.5 text-[11px] font-medium text-amber-100 hover:bg-amber-300/10">
            {copy.cta} →
          </Link>
        ) : (
          <a href="#community-console-tabs" className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-white/10">
            {copy.cta} →
          </a>
        )}
        {!installed && opensCapital && <span className="self-center text-[10px] text-amber-200/80">Install the ecosystem before preparing settlement.</span>}
        <Link href="/discover" className="self-center text-[10px] text-resolve-muted hover:text-resolve-accent">Back to Discover</Link>
      </div>
    </aside>
  );
}
