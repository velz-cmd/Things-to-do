"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { DiscoverClaimHint } from "@/components/resolve/discover/discover-claim-hint";
import { DiscoverAgentSignalMarket } from "@/components/resolve/discover/discover-agent-signal-market";
import { DiscoverCommunities } from "@/components/resolve/discover/discover-communities";
import { DiscoverDomainRadars } from "@/components/resolve/discover/discover-domain-radars";
import { DiscoverGlobalSearch } from "@/components/resolve/discover/discover-global-search";
import { DiscoverJobHero } from "@/components/resolve/discover/discover-job-hero";
import { DiscoverLiveFeed } from "@/components/resolve/discover/discover-live-feed";
import { DiscoverNetworkPulse } from "@/components/resolve/discover/discover-network-pulse";
import { DiscoverOpportunityQueue } from "@/components/resolve/discover/discover-opportunity-queue";
import { DiscoverTrendingGaps } from "@/components/resolve/discover/discover-trending-gaps";
import { DiscoverValueBubblemap } from "@/components/resolve/discover/discover-value-bubblemap";
import { DiscoverActionsProvider } from "@/components/resolve/discover/discover-actions-provider";
import { DiscoverRadarFeedProvider } from "@/components/resolve/discover/discover-radar-feed-provider";
import {
  DiscoverActionAuditPanel,
  DiscoverActionAuditProvider,
} from "@/components/resolve/discover/discover-action-audit-panel";
import { DiscoverRoleFilters } from "@/components/resolve/discover/discover-role-filters";
import type { DiscoverJobId } from "@/lib/discover/discover-jobs";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { sectionVisibleForRole } from "@/lib/discover/role-filters";
import type { DiscoverIntent } from "@/lib/discover/types";

const DOMAIN_CHIPS = [
  { label: "Music", kind: "music" as const },
  { label: "OSS", kind: "oss" as const },
  { label: "Research", kind: "research" as const },
  { label: "DAO", kind: "protocol" as const },
  { label: "All", kind: "all" as const },
];

/** Job-first Discover — pick what to do, then proof and actions. */
export function DiscoverSurface() {
  const { user } = useAuth();
  return (
    <DiscoverActionAuditProvider>
      <DiscoverRadarFeedProvider>
        <DiscoverActionsProvider signedIn={Boolean(user)}>
          <DiscoverSurfaceContent user={user} />
          <DiscoverActionAuditPanel />
        </DiscoverActionsProvider>
      </DiscoverRadarFeedProvider>
    </DiscoverActionAuditProvider>
  );
}

function roleToIntent(role: DiscoverRole): DiscoverIntent {
  const map: Record<DiscoverRole, DiscoverIntent> = {
    community: "earn",
    funder: "fund",
    founder: "build",
    operator: "operate",
    dao: "sponsor",
    all: "all",
  };
  return map[role];
}

function DiscoverSurfaceContent({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const [query, setQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState<string | null>(null);
  const [role, setRole] = useState<DiscoverRole>("all");
  const [activeJob, setActiveJob] = useState<DiscoverJobId | null>(null);
  const intent = roleToIntent(role);
  const [communityKind, setCommunityKind] = useState<
    "all" | "music" | "oss" | "research" | "protocol"
  >("all");

  const effectiveQuery = queueFilter ?? query;

  function scrollToCommunities(kind: typeof communityKind) {
    setCommunityKind(kind);
    document.getElementById("communities")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleJobSelect(jobId: DiscoverJobId, nextRole: DiscoverRole, scrollTo: string) {
    setActiveJob(jobId);
    setRole(nextRole);
    window.requestAnimationFrame(() => {
      if (scrollTo === "discover-search") {
        document.getElementById("discover-search")?.scrollIntoView({ behavior: "smooth" });
        document.querySelector<HTMLInputElement>("#discover-search input")?.focus();
        return;
      }
      document.getElementById(scrollTo)?.scrollIntoView({ behavior: "smooth" });
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 py-8 pb-12 lg:px-8">
      <DiscoverJobHero activeJob={activeJob} onSelectJob={handleJobSelect} />

      <div id="discover-search" className="scroll-mt-24">
        <DiscoverGlobalSearch
          signedIn={Boolean(user)}
          query={query}
          onQueryChange={setQuery}
          onQueueFilter={setQueueFilter}
        />
      </div>

      <details className="group mb-6 mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <summary className="cursor-pointer list-none text-[11px] font-medium text-resolve-muted marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="text-resolve-calm-periwinkle group-open:text-white">I am a…</span>
          <span className="ml-2 text-resolve-muted-dim">(optional — auto-set when you pick a job)</span>
        </summary>
        <DiscoverRoleFilters value={role} onChange={setRole} className="mt-3" />
      </details>

      {sectionVisibleForRole("pulse", role) && <DiscoverNetworkPulse className="mb-6" />}

      {user && sectionVisibleForRole("claim", role) && <DiscoverClaimHint />}

      {sectionVisibleForRole("bubblemap", role) && (
        <DiscoverValueBubblemap className="mb-10" intent={intent} role={role} />
      )}

      <div className="mb-8 flex flex-wrap gap-2">
        {DOMAIN_CHIPS.map((d) => (
          <button
            key={d.label}
            type="button"
            onClick={() => {
              if (d.kind === "protocol") {
                document.getElementById("radar-dao")?.scrollIntoView({ behavior: "smooth" });
              } else if (d.kind === "research") {
                document.getElementById("radar-dao")?.scrollIntoView({ behavior: "smooth" });
              } else if (d.kind === "all") {
                scrollToCommunities("all");
              } else {
                document.getElementById(`radar-${d.kind === "oss" ? "oss" : d.kind}`)?.scrollIntoView({
                  behavior: "smooth",
                });
              }
            }}
            className="rounded-full border border-resolve-calm-periwinkle/20 bg-white/[0.03] px-3 py-1 text-[11px] text-resolve-muted transition hover:border-resolve-calm-periwinkle/35 hover:text-white"
          >
            {d.label}
          </button>
        ))}
      </div>

      {sectionVisibleForRole("trending", role) && (
        <DiscoverTrendingGaps
          signedIn={Boolean(user)}
          query={effectiveQuery}
          intent={intent}
          role={role}
          className="mb-12"
        />
      )}

      {sectionVisibleForRole("radars", role) && (
        <DiscoverDomainRadars
          signedIn={Boolean(user)}
          query={effectiveQuery}
          intent={intent}
          role={role}
          className="mb-12"
        />
      )}

      {sectionVisibleForRole("liveFeed", role) && (
        <DiscoverLiveFeed signedIn={Boolean(user)} className="mb-12" />
      )}

      {sectionVisibleForRole("opportunities", role) && (
        <DiscoverOpportunityQueue
          signedIn={Boolean(user)}
          query={effectiveQuery}
          intent={intent}
          role={role}
          className="mb-12"
        />
      )}

      {sectionVisibleForRole("agentSignals", role) && (
        <DiscoverAgentSignalMarket signedIn={Boolean(user)} className="mb-12" />
      )}

      {sectionVisibleForRole("communities", role) && (
        <DiscoverCommunities
          kindFilter={communityKind}
          onKindFilterChange={setCommunityKind}
          signedIn={Boolean(user)}
          role={role}
        />
      )}

      <footer className="mt-12 border-t border-resolve-border/40 pt-8">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-resolve-muted-dim"
          aria-label="Discover navigation"
        >
          <Link href="/capital" className="hover:text-resolve-muted">
            Capital
          </Link>
          <Link href="/communities" className="hover:text-resolve-muted">
            Communities
          </Link>
          <Link href="/program" className="hover:text-resolve-muted">
            Program guide
          </Link>
          <Link href="/claim" className="hover:text-resolve-muted">
            Claim
          </Link>
        </nav>
      </footer>
    </div>
  );
}
