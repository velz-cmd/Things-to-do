"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DiscoverRadarFeedPayload } from "@/lib/discover/types";

type DiscoverRadarFeedContextValue = {
  feed: DiscoverRadarFeedPayload | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const DiscoverRadarFeedContext = createContext<DiscoverRadarFeedContextValue | null>(null);

export function DiscoverRadarFeedProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<DiscoverRadarFeedPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/discover/radar-feed?limit=24", { credentials: "include" });
      const data = (await res.json()) as DiscoverRadarFeedPayload;
      if (data.ok) setFeed(data);
    } catch {
      setFeed(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  const value = useMemo(() => ({ feed, loading, refresh }), [feed, loading, refresh]);

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
