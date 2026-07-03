"use client";

import Link from "next/link";
import clsx from "clsx";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { CommunityIntent } from "@/lib/communities/community-nav";
import { COMMUNITY_INTENT_ANCHOR } from "@/lib/communities/community-nav";

type IntentCopy = {
  title: string;
  detail: string;
  cta: string;
};

const INTENT_COPY: Record<
  CommunityIntent,
  Partial<Record<DiscoverRole | "default", IntentCopy>>
> = {
  fund: {
    funder: {
      title: "Fund this community",
      detail: "Select a program below and add USDC to the pool — obligations clear when you deploy on Arc.",
      cta: "Go to programs",
    },
    dao: {
      title: "Fund a grant pool",
      detail: "Stake USDC into a program pool — treasury fills as verified authorizations arrive.",
      cta: "Programs",
    },
    default: {
      title: "Fund programs here",
      detail: "Install RESOLVE if needed, then fund an active program from the console.",
      cta: "Programs",
    },
  },
  install: {
    founder: {
      title: "Run programs beside your stack",
      detail: "RESOLVE is attached — sync sensors and create your first payout program.",
      cta: "Console",
    },
    operator: {
      title: "Connect sensors",
      detail: "Link GitHub, ListenBrainz, or research APIs on Profile — activity syncs here.",
      cta: "Sensor health",
    },
    default: {
      title: "Attach this community",
      detail: "Community installed — verified activity ranks on Discover when sensors run.",
      cta: "Open console",
    },
  },
  create_program: {
    founder: {
      title: "Create a payout program",
      detail: "Programs define budget and rules — fund the pool, then deploy when obligations arrive.",
      cta: "Programs",
    },
    default: {
      title: "Program created from Discover",
      detail: "Review the active program below — fund it and connect sources if sensors are empty.",
      cta: "Programs",
    },
  },
  review_obligations: {
    operator: {
      title: "Review pending obligations",
      detail: "Authorizations from live sensors appear below — verify amounts before deploying on Arc.",
      cta: "Obligations",
    },
    default: {
      title: "Review obligations",
      detail: "Ledger authorizations waiting for pool funding or Arc deploy.",
      cta: "Obligations",
    },
  },
  approve_payouts: {
    funder: {
      title: "Approve payouts on Arc",
      detail: "Fund the program pool if needed, then deploy the authorized batch to settle payees.",
      cta: "Programs",
    },
    default: {
      title: "Approve payouts",
      detail: "Deploy on Arc when obligations are funded — real USDC settlement to mapped wallets.",
      cta: "Programs",
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

  const anchor = COMMUNITY_INTENT_ANCHOR[intent as CommunityIntent] ?? "console";
  const isFund = intent === "fund" || intent === "approve_payouts";

  return (
    <div
      className={clsx(
        "mb-6 rounded-xl border px-4 py-3",
        isFund
          ? "border-amber-500/25 bg-amber-500/5"
          : "border-resolve-accent/25 bg-resolve-accent/5",
      )}
    >
      <p className="text-sm font-semibold text-white">{copy.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-resolve-muted">{copy.detail}</p>
      <p className="mt-1 text-[10px] text-resolve-muted-dim">
        {catalog.name} · {catalog.tagline}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`#${anchor}`}
          className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-white/10"
        >
          {copy.cta} →
        </a>
        {!installed && (intent === "fund" || intent === "approve_payouts") && (
          <span className="self-center text-[10px] text-amber-200/80">
            Install RESOLVE first (header)
          </span>
        )}
        <Link
          href="/discover"
          className="self-center text-[10px] text-resolve-muted hover:text-resolve-accent"
        >
          Back to Discover
        </Link>
      </div>
    </div>
  );
}
