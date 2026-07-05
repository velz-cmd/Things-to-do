"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { DiscoverRadarFeedPayload } from "@/lib/discover/types";
import { useDiscoverRadarFeedQuery } from "@/lib/query/hooks";
import { isUsefulDiscoverFeed } from "@/lib/discover/feed-hydration";

type DiscoverRadarFeedContextValue = {
  feed: DiscoverRadarFeedPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const DiscoverRadarFeedContext = createContext<DiscoverRadarFeedContextValue | null>(null);

export function DiscoverRadarFeedProvider({ children }: { children: ReactNode }) {
  const query = useDiscoverRadarFeedQuery(24);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const feed = query.data ?? null;
  const stillWarming =
    !query.isFetched || (query.isFetching && feed != null && !isUsefulDiscoverFeed(feed));

  const value = useMemo(
    () => ({
      feed,
      loading: stillWarming,
      error:
        query.isError ? "Could not load trending radar"
        : feed?.degradedParts?.includes("client_timeout") ||
            feed?.degradedParts?.includes("timeout") ?
          "Some signals timed out — showing partial data"
        : null,
      refresh,
    }),
    [feed, stillWarming, query.isError, refresh],
  );

  return (
    <DiscoverRadarFeedContext.Provider value={value}>
      {children}
    </DiscoverRadarFeedContext.Provider>
  );
}

export function useDiscoverRadarFeed() {
  const ctx = useContext(DiscoverRadarFeedContext);
  if (!ctx) {
    throw new Error("useDiscoverRadarFeed must be used within DiscoverRadarFeedProvider");
  }
  return ctx;
}
