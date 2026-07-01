"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { DiscoverRadarFeedPayload } from "@/lib/discover/types";
import { emptyRadarFeedPayload } from "@/lib/discover/radar-feed-fallback";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { emptyConnectionState } from "@/lib/profile/connection-state-types";

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: "include", signal });
  if (!res.ok) throw new Error(`fetch_failed:${url}`);
  return res.json() as Promise<T>;
}

export function useProfileBootstrapQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.profileBootstrap,
    enabled,
    queryFn: ({ signal }) => fetchJson("/api/profile/bootstrap", signal),
    staleTime: 45_000,
  });
}

export function useUserConnectionsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.userConnections,
    enabled,
    queryFn: async ({ signal }) => {
      try {
        return await fetchJson<UserConnectionState & { ok?: boolean }>(
          "/api/profile/connections",
          signal,
        );
      } catch {
        return { ok: false, ...emptyConnectionState() };
      }
    },
    staleTime: 60_000,
  });
}

export function useDiscoverRadarFeedQuery(limit = 24) {
  return useQuery({
    queryKey: queryKeys.discoverRadarFeed(limit),
    queryFn: async ({ signal }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 28_000);
      const onParent = () => controller.abort();
      signal?.addEventListener("abort", onParent);
      try {
        const data = await fetchJson<DiscoverRadarFeedPayload>(
          `/api/discover/radar-feed?limit=${limit}`,
          controller.signal,
        );
        return data;
      } catch {
        return emptyRadarFeedPayload({ degraded: true });
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onParent);
      }
    },
    staleTime: 90_000,
    gcTime: 300_000,
    placeholderData: (prev) => prev,
  });
}

export function useCapitalWalletQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.capitalWallet,
    enabled,
    queryFn: ({ signal }) => fetchJson("/api/capital/wallet", signal),
    staleTime: 30_000,
  });
}

export function prefetchDiscoverTab(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.discoverRadarFeed(24),
    queryFn: () => fetchJson("/api/discover/radar-feed?limit=24"),
    staleTime: 90_000,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.userConnections,
    queryFn: () => fetchJson("/api/profile/connections"),
    staleTime: 90_000,
  });
}

export function prefetchProfileTab(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.profileBootstrap,
    queryFn: () => fetchJson("/api/profile/bootstrap"),
    staleTime: 90_000,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.userConnections,
    queryFn: () => fetchJson("/api/profile/connections"),
    staleTime: 90_000,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.profileWork,
    queryFn: () => fetchJson("/api/profile/work"),
    staleTime: 90_000,
  });
}
