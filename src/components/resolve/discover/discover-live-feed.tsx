"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Activity } from "lucide-react";
import type { LiveEventItem } from "@/lib/events/live";
import { normalizeLiveEventDomain } from "@/lib/events/live-feed-labels";
import {
  liveEventActions,
  primaryLiveEventAction,
  receiptHrefForEvent,
} from "@/lib/discover/live-feed-actions";
import { DiscoverActionChip } from "@/components/resolve/discover/discover-action-card";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { DiscoverFeedSkeleton } from "@/components/resolve/discover/discover-skeletons";
import { discoverFetchErrorToast } from "@/lib/discover/fetch-error-toast";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import {
  DiscoverRetryButton,
  DiscoverStatePanel,
} from "@/components/resolve/discover/discover-state-panel";

type LiveEventsResponse = {
  ok: boolean;
  live: boolean;
  total: number;
  events: LiveEventItem[];
  updatedAt: string;
};

type FeedDomainFilter = "all" | "oss" | "music" | "research";

const FEED_DOMAIN_CHIPS: { id: FeedDomainFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "oss", label: "OSS" },
  { id: "music", label: "Music" },
  { id: "research", label: "Research" },
];

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function DiscoverLiveFeed({
  className,
  signedIn,
}: {
  className?: string;
  signedIn: boolean;
}) {
  const { runAction } = useDiscoverActions();
  const [data, setData] = useState<LiveEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<FeedDomainFilter>("all");
  const dataRef = useRef<LiveEventsResponse | null>(null);
  dataRef.current = data;

  const loadFeed = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("limit", "20");
    params.set("scope", "network");
    const apiDomain = normalizeLiveEventDomain(domainFilter === "all" ? null : domainFilter);
    if (apiDomain) params.set("domain", apiDomain);

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/live?${params}`);
      if (!res.ok) throw new Error("Live feed unavailable");
      const d = (await res.json()) as LiveEventsResponse;
      if (!d.ok) throw new Error("Live feed unavailable");
      setData(d);
    } catch {
      setError("Could not load live feed");
      discoverFetchErrorToast(
        "discover-live-feed",
        "Live feed unavailable",
        () => void loadFeed(),
        Boolean(dataRef.current),
      );
    } finally {
      setLoading(false);
    }
  }, [domainFilter]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const events = useMemo(() => data?.events ?? [], [data?.events]);

  const actions = (
    <>
      {data?.live && (
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300">
          Live · {formatRelative(data.updatedAt)}
        </span>
      )}
      <DiscoverSectionRefresh
        sectionId="live-feed"
        onRefresh={loadFeed}
        lastUpdated={data?.updatedAt}
      />
    </>
  );

  return (
    <DiscoverPremiumSection
      id="live-feed"
      title="Live value feed"
      subtitle="PR merges, program funds, claims, Arc settlements, identity links, sensor connects"
      className={className}
      actions={actions}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FEED_DOMAIN_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setDomainFilter(chip.id)}
            className={clsx(
              "rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition",
              domainFilter === chip.id
                ? "border-resolve-accent/40 bg-resolve-accent/15 text-resolve-accent"
                : "border-white/10 text-resolve-muted hover:text-white",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <DiscoverFeedSkeleton />
      ) : error && !events.length ? (
        <DiscoverStatePanel variant="error">
          <p className="text-sm text-resolve-muted">{error}</p>
          <DiscoverRetryButton onClick={() => void loadFeed()} />
        </DiscoverStatePanel>
      ) : !events.length ? (
        <DiscoverStatePanel variant="empty">
          <Activity className="mx-auto h-8 w-8 text-resolve-calm-periwinkle/60" strokeWidth={1.25} />
          <p className="mt-3 text-sm text-resolve-muted">
            {domainFilter !== "all"
              ? `No ${domainFilter} events yet — activity appears as communities sync.`
              : "No events yet. Install a community in Gaps or Radars — live value streams in here automatically."}
          </p>
        </DiscoverStatePanel>
      ) : (
        <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02]">
          {events.map((item) => {
            const primary = primaryLiveEventAction(item);
            const secondary = liveEventActions(item).filter((a) => a.id !== primary.id);
            const receipt = receiptHrefForEvent(item);

            return (
              <li key={item.id} className="min-w-0 px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void runAction(primary, "live-feed-row")}
                        className="text-left text-sm font-medium text-white hover:text-resolve-accent"
                      >
                        {item.title}
                      </button>
                      {item.domain && (
                        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-resolve-muted">
                          {item.domain}
                        </span>
                      )}
                      {item.status && (
                        <span className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
                          {item.status.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-resolve-muted">
                      {item.entityPath ? (
                        <Link href={item.entityPath} className="hover:text-resolve-accent hover:underline">
                          {item.detail}
                        </Link>
                      ) : (
                        item.detail
                      )}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-resolve-muted-dim">
                      {item.evidence}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <DiscoverActionChip
                        action={primary}
                        signedIn={signedIn}
                        surface="live-feed-primary"
                      />
                      {receipt && (
                        <Link
                          href={receipt}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-resolve-accent hover:bg-white/[0.08]"
                        >
                          Receipt →
                        </Link>
                      )}
                      {secondary.slice(0, 2).map((a) => (
                        <DiscoverActionChip
                          key={a.id}
                          action={a}
                          signedIn={signedIn}
                          surface="live-feed-secondary"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {item.amountUsd != null && item.amountUsd > 0 && (
                      <p className="text-sm font-semibold tabular-nums text-emerald-300">
                        ${item.amountUsd.toFixed(4)}
                      </p>
                    )}
                    <p className="text-[10px] text-resolve-muted-dim">{formatRelative(item.at)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DiscoverPremiumSection>
  );
}
