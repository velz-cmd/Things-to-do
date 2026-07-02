"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { DiscoverDomainRadars } from "@/components/resolve/discover/discover-domain-radars";
import { DiscoverGlobalSearch } from "@/components/resolve/discover/discover-global-search";
import { DiscoverJobHero } from "@/components/resolve/discover/discover-job-hero";
import { DiscoverNetworkPulse } from "@/components/resolve/discover/discover-network-pulse";
import { DiscoverOpportunityQueue } from "@/components/resolve/discover/discover-opportunity-queue";
import { DiscoverTrendingGaps } from "@/components/resolve/discover/discover-trending-gaps";

const DiscoverValueBubblemap = dynamic(
  () =>
    import("@/components/resolve/discover/discover-value-bubblemap").then(
      (m) => m.DiscoverValueBubblemap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
    ),
  },
);
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import { DiscoverActionsProvider } from "@/components/resolve/discover/discover-actions-provider";
import { DiscoverCommunityConsoleProvider } from "@/components/resolve/discover/discover-community-console-provider";
import { DiscoverRadarFeedProvider } from "@/components/resolve/discover/discover-radar-feed-provider";
import {
  DiscoverActionAuditPanel,
  DiscoverActionAuditProvider,
} from "@/components/resolve/discover/discover-action-audit-panel";
import { DiscoverCommunities } from "@/components/resolve/discover/discover-communities";
import {
  DiscoverWorkspaceNav,
  defaultLaneForRole,
  laneForJob,
  type DiscoverWorkspaceLane,
} from "@/components/resolve/discover/discover-workspace-nav";
import type { DiscoverJobId } from "@/lib/discover/discover-jobs";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DiscoverIntent } from "@/lib/discover/types";
import {
  loadPersistedDiscoverRole,
  persistDiscoverRole,
} from "@/lib/discover/discover-role-persist";

/** Discover — one workspace tab at a time; value graph always below. */
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
  const [lane, setLane] = useState<DiscoverWorkspaceLane>("gaps");
  const intent = roleToIntent(role);
  const { feed } = useDiscoverRadarFeed();
  const showPulse =
    (feed?.realSignalCount ?? 0) > 0 || (feed?.intelligence?.leakingUsd ?? 0) > 0;

  useEffect(() => {
    const saved = loadPersistedDiscoverRole();
    if (saved) {
      setRole(saved);
      setLane(defaultLaneForRole(saved));
    }
  }, []);

  const effectiveQuery = queueFilter ?? query;

  function scrollToDiscoverAnchor(scrollTo: string) {
    window.requestAnimationFrame(() => {
      const anchorId =
        scrollTo === "discover-search"
          ? "discover-search"
          : scrollTo === "opportunities"
            ? "opportunities"
            : scrollTo === "value-bubblemap"
              ? "value-bubblemap"
              : "discover-workspace";
      document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth" });
      if (scrollTo === "discover-search") {
        document.querySelector<HTMLInputElement>("#discover-search input")?.focus();
      }
    });
  }

  function switchLane(next: DiscoverWorkspaceLane) {
    setLane(next);
    window.requestAnimationFrame(() => {
      document.getElementById("discover-workspace")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  function handleJobSelect(jobId: DiscoverJobId, nextRole: DiscoverRole, scrollTo: string) {
    setActiveJob(jobId);
    setRole(nextRole);
    persistDiscoverRole(nextRole);
    setLane(laneForJob(jobId));
    scrollToDiscoverAnchor(scrollTo);
  }

  return (
    <div className="resolve-grid-bg min-h-screen pb-12">
      <div className="relative mx-auto w-full max-w-6xl overflow-x-hidden px-4 py-6 lg:px-8 lg:py-8">
        <DiscoverJobHero activeJob={activeJob} onSelectJob={handleJobSelect} />

        <div id="discover-search" className="discover-section-stack scroll-mt-24">
          <DiscoverGlobalSearch
            signedIn={Boolean(user)}
            query={query}
            onQueryChange={setQuery}
            onQueueFilter={setQueueFilter}
          />
        </div>

        {showPulse && <DiscoverNetworkPulse variant="strip" className="discover-section-stack" />}

        <section id="discover-workspace" className="discover-section-stack scroll-mt-24 space-y-4">
          <DiscoverWorkspaceNav lane={lane} onLaneChange={switchLane} />

          <div key={lane} className="min-h-[200px]">
            {lane === "gaps" && (
              <DiscoverTrendingGaps
                signedIn={Boolean(user)}
                query={effectiveQuery}
                intent={intent}
                role={role}
                needType={needType}
                onSwitchLane={switchLane}
              />
            )}

            {lane === "radars" && (
              <DiscoverDomainRadars
                signedIn={Boolean(user)}
                query={effectiveQuery}
                intent={intent}
                role={role}
                needType={needType}
                onSwitchLane={switchLane}
              />
            )}

            {lane === "board" && (
              <DiscoverOpportunityQueue
                signedIn={Boolean(user)}
                query={effectiveQuery}
                intent={intent}
                role={role}
                needType={needType}
                onSwitchLane={switchLane}
              />
            )}
          </div>
        </section>

        <div className="discover-section-stack scroll-mt-24">
          <DiscoverCommunities signedIn={Boolean(user)} role={role} />
        </div>

        <div id="value-bubblemap" className="discover-section-stack scroll-mt-24">
          <DiscoverValueBubblemap
            intent={intent}
            role={role}
            signedIn={Boolean(user)}
            onOpenBoard={() => switchLane("board")}
          />
        </div>

        <footer className="discover-on-canvas mt-10 border-t border-resolve-border/30 pt-6">
          <p className="discover-muted mb-3 text-center text-[10px]">
            All communities · live consoles on{" "}
            <Link href="/communities" className="text-resolve-accent hover:underline">
              Communities
            </Link>{" "}
            · agent intel on{" "}
            <Link href="/mission" className="text-resolve-accent hover:underline">
              Mission
            </Link>{" "}
            · payouts on{" "}
            <Link href="/capital" className="text-resolve-accent hover:underline">
              Capital
            </Link>
          </p>
          <nav
            className="discover-muted flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs"
            aria-label="Discover navigation"
          >
            <Link href="/capital">Capital</Link>
            <Link href="/communities">Communities</Link>
            <Link href="/mission">Mission</Link>
            <Link href="/stack">Stack</Link>
            <Link href="/claim">Claim</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
