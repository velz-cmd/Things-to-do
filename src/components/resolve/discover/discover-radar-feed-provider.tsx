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

  const value = useMemo(
    () => ({
      feed: query.data ?? null,
      loading: !query.data && (query.isPending || query.isFetching),
      error:
        query.isError ? "Could not load trending radar"
        : query.data?.degradedParts?.includes("client_timeout") ||
            query.data?.degradedParts?.includes("timeout") ?
          "Some signals timed out — showing partial data"
        : null,
      refresh,
    }),
    [query.data, query.isPending, query.isFetching, query.isError, refresh],
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
