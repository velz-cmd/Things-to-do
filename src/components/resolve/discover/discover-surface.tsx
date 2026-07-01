"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { DiscoverEarnSurface } from "@/components/resolve/discover/discover-earn-surface";
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
import { DiscoverCommunityConsoleProvider } from "@/components/resolve/discover/discover-community-console-provider";
import { DiscoverRadarFeedProvider } from "@/components/resolve/discover/discover-radar-feed-provider";
import {
  DiscoverActionAuditPanel,
  DiscoverActionAuditProvider,
} from "@/components/resolve/discover/discover-action-audit-panel";
import { DiscoverRefinePanel } from "@/components/resolve/discover/discover-refine-panel";
import type { DiscoverJobId } from "@/lib/discover/discover-jobs";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { sectionVisibleForRole } from "@/lib/discover/role-filters";
import type { DiscoverIntent } from "@/lib/discover/types";

/** Job-first Discover — pick what to do, then proof and actions. */
export function DiscoverSurface() {
  const { user } = useAuth();
  return (
    <DiscoverActionAuditProvider>
      <DiscoverRadarFeedProvider>
        <DiscoverActionsProvider signedIn={Boolean(user)}>
          <DiscoverCommunityConsoleProvider>
            <DiscoverSurfaceContent user={user} />
            <DiscoverActionAuditPanel />
          </DiscoverCommunityConsoleProvider>
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
  const [needType, setNeedType] = useState<DiscoverNeedTypeFilter>("all");
  const [exploreOpen, setExploreOpen] = useState(false);
  const intent = roleToIntent(role);
  const [communityKind, setCommunityKind] = useState<
    "all" | "music" | "media" | "oss" | "research" | "education" | "protocol"
  >("all");

  const effectiveQuery = queueFilter ?? query;
  const focusedView = role !== "all" || activeJob !== null;

  function scrollToCommunities(kind: typeof communityKind) {
    setCommunityKind(kind);
    document.getElementById("communities")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleDomainJump(anchorId: string) {
    if (anchorId === "communities") {
      scrollToCommunities("all");
      return;
    }
    document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth" });
  }

  function handleJobSelect(jobId: DiscoverJobId, nextRole: DiscoverRole, scrollTo: string) {
    setActiveJob(jobId);
    setRole(nextRole);
    setExploreOpen(true);
    window.requestAnimationFrame(() => {
      if (scrollTo === "discover-search") {
        document.getElementById("discover-search")?.scrollIntoView({ behavior: "smooth" });
        document.querySelector<HTMLInputElement>("#discover-search input")?.focus();
        return;
      }
      document.getElementById(scrollTo)?.scrollIntoView({ behavior: "smooth" });
    });
  }

  const showDeepSections = focusedView || exploreOpen;

  return (
    <div className="resolve-grid-bg min-h-screen pb-16">
      <div className="relative mx-auto w-full max-w-6xl overflow-x-hidden px-4 py-8 pb-12 lg:px-8 lg:py-10">
        <DiscoverJobHero activeJob={activeJob} onSelectJob={handleJobSelect} />

        <div id="discover-search" className="discover-section-stack scroll-mt-24">
          <DiscoverGlobalSearch
            signedIn={Boolean(user)}
            query={query}
            onQueryChange={setQuery}
            onQueueFilter={setQueueFilter}
          />
        </div>

        <div className="discover-section-stack">
          {sectionVisibleForRole("earn", role) && (
            <DiscoverEarnSurface signedIn={Boolean(user)} />
          )}

          {sectionVisibleForRole("agentMarket", role) && (
            <DiscoverAgentSignalMarket signedIn={Boolean(user)} />
          )}
        </div>

        {(sectionVisibleForRole("pulse", role) || sectionVisibleForRole("bubblemap", role)) && (
          <div className="discover-section-stack mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
            {sectionVisibleForRole("pulse", role) && <DiscoverNetworkPulse />}
            {sectionVisibleForRole("bubblemap", role) && (
              <DiscoverValueBubblemap intent={intent} role={role} signedIn={Boolean(user)} />
            )}
          </div>
        )}

        <div className="discover-section-stack">
          <DiscoverRefinePanel
            role={role}
            onRoleChange={setRole}
            needType={needType}
            onNeedTypeChange={setNeedType}
            onDomainJump={handleDomainJump}
          />
        </div>

        {!showDeepSections && (
          <div className="discover-section-stack">
            <button
              type="button"
              onClick={() => setExploreOpen(true)}
              className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-resolve-border/50 bg-resolve-surface/25 px-5 py-4 text-left backdrop-blur-md transition hover:border-resolve-accent/30 hover:bg-resolve-accent/[0.06]"
            >
              <div>
                <p className="text-sm font-semibold text-white">Explore the full network</p>
                <p className="mt-1 text-[11px] text-resolve-muted">
                  Trending gaps, domain radars, live feed, opportunities, and communities
                </p>
              </div>
              <ChevronDown className="h-5 w-5 shrink-0 text-resolve-muted transition group-hover:text-resolve-accent" />
            </button>
          </div>
        )}

        {showDeepSections && (
          <div className="discover-section-stack">
            {sectionVisibleForRole("trending", role) && (
              <DiscoverTrendingGaps
                signedIn={Boolean(user)}
                query={effectiveQuery}
                intent={intent}
                role={role}
                needType={needType}
              />
            )}

            {sectionVisibleForRole("radars", role) && (
              <DiscoverDomainRadars
                signedIn={Boolean(user)}
                query={effectiveQuery}
                intent={intent}
                role={role}
                needType={needType}
              />
            )}

            {sectionVisibleForRole("liveFeed", role) && (
              <DiscoverLiveFeed signedIn={Boolean(user)} />
            )}

            {sectionVisibleForRole("opportunities", role) && (
              <DiscoverOpportunityQueue
                signedIn={Boolean(user)}
                query={effectiveQuery}
                intent={intent}
                role={role}
                needType={needType}
              />
            )}

            {sectionVisibleForRole("communities", role) && (
              <DiscoverCommunities
                kindFilter={communityKind}
                onKindFilterChange={setCommunityKind}
                signedIn={Boolean(user)}
                role={role}
              />
            )}
          </div>
        )}

        <footer className="discover-on-canvas mt-16 border-t pt-8">
          <nav
            className="discover-muted flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs"
            aria-label="Discover navigation"
          >
            <Link href="/capital">Capital</Link>
            <Link href="/communities">Communities</Link>
            <Link href="/stack">Stack</Link>
            <Link href="/program">Program guide</Link>
            <Link href="/claim">Claim</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
