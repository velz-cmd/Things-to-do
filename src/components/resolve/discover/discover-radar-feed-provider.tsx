"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DiscoverRadarFeedPayload } from "@/lib/discover/types";
import { discoverFetchErrorToast } from "@/lib/discover/fetch-error-toast";

type DiscoverRadarFeedContextValue = {
  feed: DiscoverRadarFeedPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const DiscoverRadarFeedContext = createContext<DiscoverRadarFeedContextValue | null>(null);

export function DiscoverRadarFeedProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<DiscoverRadarFeedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<DiscoverRadarFeedPayload | null>(null);
  feedRef.current = feed;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discover/radar-feed?limit=24", { credentials: "include" });
      const data = (await res.json()) as DiscoverRadarFeedPayload;
      if (data.gaps !== undefined) {
        setFeed(data);
      }
      if (!res.ok || data.ok === false) {
        throw new Error("Radar feed unavailable");
      }
      setError(null);
    } catch {
      setError("Could not load trending radar");
      discoverFetchErrorToast(
        "discover-radar-feed",
        "Trending radar unavailable",
        refresh,
        Boolean(feedRef.current),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ feed, loading, error, refresh }),
    [feed, loading, error, refresh],
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
