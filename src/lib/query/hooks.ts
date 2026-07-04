"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { DiscoverRadarFeedPayload } from "@/lib/discover/types";
import { emptyRadarFeedPayload } from "@/lib/discover/radar-feed-fallback";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { emptyConnectionState } from "@/lib/profile/connection-state-types";
import type { CapitalStateResponse } from "@/lib/capital/state";

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: "include", signal });
  if (!res.ok) throw new Error(`fetch_failed:${url}`);
  return res.json() as Promise<T>;
}

const DISCOVER_FEED_TIMEOUT_MS = 18_000;
const COMMUNITY_HUB_TIMEOUT_MS = 8_000;
const COMMUNITY_SURFACE_TIMEOUT_MS = 10_000;

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onParent = () => controller.abort();
  parentSignal?.addEventListener("abort", onParent);
  try {
    return await fetchJson<T>(url, controller.signal);
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", onParent);
  }
}

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
    queryKey: queryKeys.profileState,
    enabled,
    queryFn: async ({ signal }) => {
      try {
        return await fetchJson<UserConnectionState & { ok?: boolean }>(
          "/api/profile/state",
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
    queryKey: queryKeys.capitalState,
    enabled,
    queryFn: ({ signal }) => fetchJson("/api/capital/state", signal),
    staleTime: 30_000,
  });
}

export function useCapitalStateQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.capitalState,
    enabled,
    queryFn: ({ signal }) => fetchJson<CapitalStateResponse>("/api/capital/state", signal),
    staleTime: 30_000,
    gcTime: 300_000,
    placeholderData: (prev) => prev,
    retry: 1,
  });
}

export function prefetchDiscoverTab(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.discoverRadarFeed(24),
    queryFn: () => discoverRadarFeedQueryFn(24),
    staleTime: 90_000,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.profileState,
    queryFn: async ({ signal }) => {
      try {
        return await fetchJson("/api/profile/state", signal);
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
    queryFn: () => fetchJsonWithTimeout("/api/communities", COMMUNITY_HUB_TIMEOUT_MS),
    staleTime: 60_000,
  });
}

export function useCommunitiesHubQuery() {
  return useQuery({
    queryKey: queryKeys.communities,
    queryFn: ({ signal }) =>
      fetchJsonWithTimeout<{ communities: unknown[]; sensorStatuses?: unknown[] }>(
        "/api/communities",
        COMMUNITY_HUB_TIMEOUT_MS,
        signal,
      ),
    staleTime: 120_000,
    gcTime: 600_000,
    placeholderData: (prev) => prev,
    retry: 1,
    retryDelay: 1_000,
  });
}

export function useCommunitySurfaceQuery(
  slug: string,
  options?: { lite?: boolean; pollWhenInstalled?: boolean; enabled?: boolean },
) {
  const lite = options?.lite ?? true;
  const mode = lite ? "lite" : "full";
  return useQuery({
    queryKey: queryKeys.communitySurface(slug, mode),
    enabled: options?.enabled ?? true,
    queryFn: ({ signal }) =>
      fetchJsonWithTimeout<{ community: import("@/lib/communities/types").CommunitySurface }>(
        `/api/communities/${slug}${lite ? "?lite=1" : ""}`,
        COMMUNITY_SURFACE_TIMEOUT_MS,
        signal,
      ).then((data) => data.community),
    staleTime: lite ? 90_000 : 30_000,
    gcTime: 600_000,
    placeholderData: (prev) => prev,
    retry: 1,
    retryDelay: 1_000,
    refetchInterval: (query) => {
      if (!options?.pollWhenInstalled) return false;
      return query.state.data?.installed ? 30_000 : false;
    },
  });
}

export function prefetchCommunitySurface(
  queryClient: ReturnType<typeof useQueryClient>,
  slug: string,
  lite = true,
) {
  const mode = lite ? "lite" : "full";
  void queryClient.prefetchQuery({
    queryKey: queryKeys.communitySurface(slug, mode),
    queryFn: () =>
      fetchJsonWithTimeout<{ community: import("@/lib/communities/types").CommunitySurface }>(
        `/api/communities/${slug}${lite ? "?lite=1" : ""}`,
        COMMUNITY_SURFACE_TIMEOUT_MS,
      ).then((data) => data.community),
    staleTime: lite ? 90_000 : 30_000,
  });
}

export function prefetchProfileTab(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.profileBootstrap,
    queryFn: () => fetchJson("/api/profile/bootstrap"),
    staleTime: 90_000,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.profileState,
    queryFn: () => fetchJson("/api/profile/state"),
    staleTime: 90_000,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.profileWork,
    queryFn: () => fetchJson("/api/profile/work"),
    staleTime: 90_000,
  });
}
