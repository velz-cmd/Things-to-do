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

const DISCOVER_FEED_TIMEOUT_MS = 18_000;

/** Shared queryFn — prefetch and provider must use the same logic (timeout + degraded fallback). */
export async function discoverRadarFeedQueryFn(
  limit: number,
  parentSignal?: AbortSignal,
): Promise<DiscoverRadarFeedPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCOVER_FEED_TIMEOUT_MS);
  const onParent = () => controller.abort();
  parentSignal?.addEventListener("abort", onParent);
  try {
    return await fetchJson<DiscoverRadarFeedPayload>(
      `/api/discover/radar-feed?limit=${limit}`,
      controller.signal,
    );
  } catch {
    return emptyRadarFeedPayload({ degraded: true, degradedParts: ["client_timeout"] });
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", onParent);
  }
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
    queryFn: ({ signal }) => discoverRadarFeedQueryFn(limit, signal),
    staleTime: 90_000,
    gcTime: 300_000,
    placeholderData: (prev) => prev,
    retry: 1,
    retryDelay: 2_000,
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
    queryFn: () => discoverRadarFeedQueryFn(24),
    staleTime: 90_000,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.userConnections,
    queryFn: async ({ signal }) => {
      try {
        return await fetchJson("/api/profile/connections", signal);
      } catch {
        return { ok: false, ...emptyConnectionState() };
      }
    },
    staleTime: 90_000,
  });
}

export function prefetchCommunitiesTab(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.communities,
    queryFn: () => fetchJson("/api/communities"),
    staleTime: 60_000,
  });
}

export function useCommunitiesHubQuery() {
  return useQuery({
    queryKey: queryKeys.communities,
    queryFn: ({ signal }) => fetchJson<{ communities: unknown[]; sensorStatuses?: unknown[] }>(
      "/api/communities",
      signal,
    ),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useCommunitySurfaceQuery(slug: string, options?: { pollWhenInstalled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.communitySurface(slug),
    queryFn: ({ signal }) =>
      fetchJson<{ community: import("@/lib/communities/types").CommunitySurface }>(
        `/api/communities/${slug}`,
        signal,
      ).then((data) => data.community),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    refetchInterval: (query) => {
      if (!options?.pollWhenInstalled) return false;
      return query.state.data?.installed ? 30_000 : false;
    },
  });
}

export function prefetchCommunitySurface(
  queryClient: ReturnType<typeof useQueryClient>,
  slug: string,
) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.communitySurface(slug),
    queryFn: () =>
      fetchJson<{ community: import("@/lib/communities/types").CommunitySurface }>(
        `/api/communities/${slug}`,
      ).then((data) => data.community),
    staleTime: 30_000,
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
