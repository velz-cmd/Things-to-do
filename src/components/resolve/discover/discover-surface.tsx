"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { DiscoverAgentSignalMarket } from "@/components/resolve/discover/discover-agent-signal-market";
import { DiscoverDomainRadars } from "@/components/resolve/discover/discover-domain-radars";
import { DiscoverGlobalSearch } from "@/components/resolve/discover/discover-global-search";
import { DiscoverJobHero } from "@/components/resolve/discover/discover-job-hero";
import { DiscoverNetworkPulse } from "@/components/resolve/discover/discover-network-pulse";
import { DiscoverOpportunityQueue } from "@/components/resolve/discover/discover-opportunity-queue";
import { DiscoverTrendingGaps } from "@/components/resolve/discover/discover-trending-gaps";
import { DiscoverValueBubblemap } from "@/components/resolve/discover/discover-value-bubblemap";
import { DiscoverEarnCompact } from "@/components/resolve/discover/discover-earn-compact";
import { DiscoverActionsProvider } from "@/components/resolve/discover/discover-actions-provider";
import { DiscoverCommunityConsoleProvider } from "@/components/resolve/discover/discover-community-console-provider";
import { DiscoverRadarFeedProvider } from "@/components/resolve/discover/discover-radar-feed-provider";
import {
  DiscoverActionAuditPanel,
  DiscoverActionAuditProvider,
} from "@/components/resolve/discover/discover-action-audit-panel";
import { DiscoverRefinePanel } from "@/components/resolve/discover/discover-refine-panel";
import {
  DiscoverWorkspaceNav,
  laneForJob,
  type DiscoverWorkspaceLane,
} from "@/components/resolve/discover/discover-workspace-nav";
import type { DiscoverJobId } from "@/lib/discover/discover-jobs";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DiscoverIntent } from "@/lib/discover/types";

/** Job-first Discover — compact landing, value graph, tabbed workspace lanes. */
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

  const effectiveQuery = queueFilter ?? query;

  function handleDomainJump(anchorId: string) {
    if (anchorId === "communities") {
      window.location.href = "/communities";
      return;
    }
    if (anchorId.startsWith("radar-")) {
      setLane("radars");
    }
    window.requestAnimationFrame(() => {
      document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth" });
    });
  }

  function handleJobSelect(jobId: DiscoverJobId, nextRole: DiscoverRole, scrollTo: string) {
    setActiveJob(jobId);
    setRole(nextRole);
    const nextLane = laneForJob(jobId);
    setLane(nextLane);

    window.requestAnimationFrame(() => {
      if (scrollTo === "discover-search") {
        document.getElementById("discover-search")?.scrollIntoView({ behavior: "smooth" });
        document.querySelector<HTMLInputElement>("#discover-search input")?.focus();
        return;
      }
      document.getElementById("discover-workspace")?.scrollIntoView({ behavior: "smooth" });
    });
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

        <div className="discover-section-stack">
          <DiscoverValueBubblemap intent={intent} role={role} signedIn={Boolean(user)} />
        </div>

        <DiscoverNetworkPulse variant="strip" className="discover-section-stack" />

        <section id="discover-workspace" className="discover-section-stack scroll-mt-24 space-y-3">
          <DiscoverWorkspaceNav lane={lane} onLaneChange={setLane} />

          {lane === "earn" && <DiscoverEarnCompact signedIn={Boolean(user)} />}

          {lane === "signals" && <DiscoverAgentSignalMarket signedIn={Boolean(user)} />}

          {lane === "gaps" && (
            <DiscoverTrendingGaps
              signedIn={Boolean(user)}
              query={effectiveQuery}
              intent={intent}
              role={role}
              needType={needType}
              limit={6}
            />
          )}

          {lane === "radars" && (
            <DiscoverDomainRadars
              signedIn={Boolean(user)}
              query={effectiveQuery}
              intent={intent}
              role={role}
              needType={needType}
            />
          )}

          {lane === "board" && (
            <DiscoverOpportunityQueue
              signedIn={Boolean(user)}
              query={effectiveQuery}
              intent={intent}
              role={role}
              needType={needType}
            />
          )}
        </section>

        <DiscoverRefinePanel
          className="discover-section-stack mt-4"
          role={role}
          onRoleChange={(next) => {
            setRole(next);
            if (next === "community") setLane("earn");
            else if (next === "funder") setLane("board");
            else if (next === "founder" || next === "operator") setLane("signals");
            else if (next === "dao") setLane("radars");
          }}
          needType={needType}
          onNeedTypeChange={setNeedType}
          onDomainJump={handleDomainJump}
        />

        <footer className="discover-on-canvas mt-10 border-t border-resolve-border/30 pt-6">
          <p className="discover-muted mb-3 text-center text-[10px]">
            Live feed and community consoles live on{" "}
            <Link href="/communities" className="text-resolve-accent hover:underline">
              Communities
            </Link>{" "}
            · Full earnings on{" "}
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
            <Link href="/stack">Stack</Link>
            <Link href="/program">Program guide</Link>
            <Link href="/claim">Claim</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
