"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { DiscoverClaimHint } from "@/components/resolve/discover/discover-claim-hint";
import { DiscoverCommunities } from "@/components/resolve/discover/discover-communities";
import { DiscoverDomainRadars } from "@/components/resolve/discover/discover-domain-radars";
import { DiscoverGlobalSearch } from "@/components/resolve/discover/discover-global-search";
import { DiscoverLiveFeed } from "@/components/resolve/discover/discover-live-feed";
import { DiscoverNetworkPulse } from "@/components/resolve/discover/discover-network-pulse";
import { DiscoverOpportunityQueue } from "@/components/resolve/discover/discover-opportunity-queue";
import { DiscoverTrendingGaps } from "@/components/resolve/discover/discover-trending-gaps";
import { DiscoverValueBubblemap } from "@/components/resolve/discover/discover-value-bubblemap";

const DOMAIN_CHIPS = [
  { label: "Music", kind: "music" as const },
  { label: "OSS", kind: "oss" as const },
  { label: "Research", kind: "research" as const },
  { label: "DAO", kind: "protocol" as const },
  { label: "All", kind: "all" as const },
];

/** Global value radar — observe and act: fund, install, claim, open entities. */
export function DiscoverSurface() {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [communityKind, setCommunityKind] = useState<
    "all" | "music" | "oss" | "research" | "protocol"
  >("all");

  function scrollToCommunities(kind: typeof communityKind) {
    setCommunityKind(kind);
    document.getElementById("communities")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = query.trim();
    if (!raw) return;

    const slash = raw.indexOf("/");
    if (slash > 0 && slash < raw.length - 1) {
      const owner = raw.slice(0, slash).trim();
      const repo = raw.slice(slash + 1).trim();
      if (owner && repo && !owner.includes(" ")) {
        router.push(
          `/e/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        );
        return;
      }
    }

    const lower = raw.toLowerCase();
    if (lower.includes("claim") || lower.includes("earn")) {
      router.push(user ? "/claim" : "/login?next=/claim");
      return;
    }
    if (lower.includes("fund") || lower.includes("program")) {
      document.getElementById("opportunities")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (lower.includes("music") || lower.includes("artist")) {
      document.getElementById("radar-music")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (lower.includes("dao")) {
      document.getElementById("radar-dao")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (lower.includes("oss") || lower.includes("github")) {
      document.getElementById("radar-oss")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    document.getElementById("trending")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Global value radar
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          Where is value being created — and what can you do right now?
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-resolve-muted">
          Open source, communities, creators, protocols, research, music, public goods. Every card
          has proof and actions — fund, install, claim, create programs, connect sensors.
        </p>
      </header>

      <DiscoverGlobalSearch
        signedIn={Boolean(user)}
        query={query}
        onQueryChange={setQuery}
        onSubmit={handleSearchSubmit}
      />

      <DiscoverNetworkPulse className="mb-6 mt-8" />

      {user && <DiscoverClaimHint />}

      <DiscoverValueBubblemap className="mb-10 mt-8" />

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
            className="rounded-full border border-resolve-border/60 px-3 py-1 text-[11px] text-resolve-muted transition hover:text-white"
          >
            {d.label}
          </button>
        ))}
      </div>

      <DiscoverTrendingGaps
        signedIn={Boolean(user)}
        query={query}
        className="mb-12 scroll-mt-24"
      />

      <DiscoverDomainRadars
        signedIn={Boolean(user)}
        query={query}
        className="mb-12"
      />

      <DiscoverLiveFeed
        signedIn={Boolean(user)}
        className="mb-12"
        domain={
          communityKind === "all"
            ? null
            : communityKind === "oss"
              ? "code"
              : communityKind
        }
      />

      <DiscoverOpportunityQueue
        signedIn={Boolean(user)}
        query={query}
        className="mb-12 scroll-mt-24"
      />

      <DiscoverCommunities kindFilter={communityKind} onKindFilterChange={setCommunityKind} />

      <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-resolve-border/40 pt-8 text-xs text-resolve-muted">
        <Link href="/capital" className="text-resolve-accent hover:underline">
          Capital — wallet & portfolio
        </Link>
        <Link href="/communities" className="text-resolve-accent hover:underline">
          Communities — deploy & sensors
        </Link>
        <Link href="/program" className="text-resolve-accent hover:underline">
          Program — role guide
        </Link>
      </footer>
    </div>
  );
}
