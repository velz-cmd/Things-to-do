"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { DiscoverClaimHint } from "@/components/resolve/discover/discover-claim-hint";
import { DiscoverCommunities } from "@/components/resolve/discover/discover-communities";
import { DiscoverEcosystemRail } from "@/components/resolve/discover/discover-ecosystem-rail";
import { DiscoverLiveFeed } from "@/components/resolve/discover/discover-live-feed";
import { DiscoverNetworkPulse } from "@/components/resolve/discover/discover-network-pulse";
import { DiscoverOpportunityQueue } from "@/components/resolve/discover/discover-opportunity-queue";
import { DiscoverOssSignals } from "@/components/resolve/discover/discover-oss-signals";
import { ValueGraph } from "@/components/resolve/discover/value-graph";

const DOMAIN_CHIPS = [
  { label: "Music", kind: "music" as const },
  { label: "OSS", kind: "oss" as const },
  { label: "Research", kind: "research" as const },
  { label: "All", kind: "all" as const },
];

/** Observe — where value exists. Act here: fund, install, view entities, claim. */
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
    if (lower.includes("music") || lower.includes("artist")) {
      scrollToCommunities("music");
      return;
    }
    if (lower.includes("oss") || lower.includes("github") || lower.includes("repo")) {
      document.getElementById("oss-signals")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (lower.includes("research") || lower.includes("citation")) {
      scrollToCommunities("research");
      return;
    }
    if (lower.includes("fund") || lower.includes("program")) {
      document.getElementById("opportunities")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (lower.includes("claim") || lower.includes("earn")) {
      router.push(user ? "/claim" : "/login?next=/claim");
      return;
    }

    document.getElementById("oss-signals")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <header className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Discover
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          Where does value already exist?
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-resolve-muted">
          Observe live authorizations, fund programs inline, install communities, and open entity
          surfaces — without leaving this tab.
        </p>
      </header>

      <DiscoverNetworkPulse className="mb-6" />

      {user && <DiscoverClaimHint />}

      <form className="relative mb-8 mt-6" onSubmit={handleSearchSubmit}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-resolve-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search owner/repo, community, program, or domain…"
          className="w-full rounded-xl border border-resolve-border bg-resolve-bg-deep/40 py-3 pl-10 pr-4 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none"
        />
        <p className="mt-2 text-[11px] text-resolve-muted-dim">
          Try <code className="text-resolve-muted">facebook/react</code> to open an entity ·{" "}
          <code className="text-resolve-muted">oss</code> for signals ·{" "}
          <code className="text-resolve-muted">fund</code> for the queue
        </p>
      </form>

      <div className="mb-8 flex flex-wrap gap-2">
        {DOMAIN_CHIPS.map((d) => (
          <button
            key={d.label}
            type="button"
            onClick={() => scrollToCommunities(d.kind)}
            className={`rounded-full border px-3 py-1 text-[11px] transition ${
              communityKind === d.kind
                ? "border-resolve-accent/40 bg-resolve-accent/10 text-resolve-accent"
                : "border-resolve-border/60 text-resolve-muted hover:text-white"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <DiscoverEcosystemRail className="mb-10" />

      <DiscoverLiveFeed
        className="mb-10"
        domain={
          communityKind === "all"
            ? null
            : communityKind === "oss"
              ? "code"
              : communityKind
        }
      />

      <ValueGraph variant="full" />

      <DiscoverOpportunityQueue
        signedIn={Boolean(user)}
        query={query}
        className="mb-12 scroll-mt-24"
      />

      <DiscoverOssSignals
        query={query}
        onInstallOss={() => setCommunityKind("oss")}
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
