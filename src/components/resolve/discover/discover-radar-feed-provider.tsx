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
import { emptyRadarFeedPayload } from "@/lib/discover/radar-feed-fallback";

type DiscoverRadarFeedContextValue = {
  feed: DiscoverRadarFeedPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const DiscoverRadarFeedContext = createContext<DiscoverRadarFeedContextValue | null>(null);

function isUsableFeed(data: DiscoverRadarFeedPayload | null | undefined): boolean {
  if (!data) return false;
  return Boolean(data.intelligence && data.domainRadars && Array.isArray(data.gaps));
}

export function DiscoverRadarFeedProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<DiscoverRadarFeedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<DiscoverRadarFeedPayload | null>(null);
  feedRef.current = feed;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
    try {
      const res = await fetch("/api/discover/radar-feed?limit=24", {
        credentials: "include",
        signal: controller.signal,
      });
      let data: DiscoverRadarFeedPayload | null = null;
      try {
        data = (await res.json()) as DiscoverRadarFeedPayload;
      } catch {
        data = null;
      }

      if (isUsableFeed(data)) {
        setFeed(data);
        setError(null);
      } else if (!res.ok) {
        throw new Error("Radar feed unavailable");
      } else {
        throw new Error("Invalid radar feed payload");
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (!isUsableFeed(feedRef.current)) {
        if (aborted) {
          setFeed(emptyRadarFeedPayload({ degraded: true, degradedParts: ["timeout"] }));
        }
        setError(aborted ? "Pulse timed out — showing defaults" : "Could not load trending radar");
        discoverFetchErrorToast(
          "discover-radar-feed",
          aborted ? "Network pulse slow — retry" : "Trending radar unavailable",
          refresh,
          Boolean(feedRef.current),
        );
      }
    } finally {
      clearTimeout(timeout);
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
