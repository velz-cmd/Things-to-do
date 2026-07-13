"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { DiscoverRadarFeedPayload } from "@/lib/discover/types";
import { emptyRadarFeedPayload } from "@/lib/discover/radar-feed-fallback";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { emptyConnectionState } from "@/lib/profile/connection-state-types";
import type { CapitalStateResponse } from "@/lib/capital/state";

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: "include", signal, cache: "no-store" });
  if (!res.ok) throw new Error(`fetch_failed:${url}`);
  return res.json() as Promise<T>;
}

const PROFILE_FAST_TIMEOUT_MS = 5_000;
const PROFILE_BOOTSTRAP_TIMEOUT_MS = 12_000;
const DISCOVER_FEED_TIMEOUT_MS = 12_000;
const COMMUNITY_HUB_TIMEOUT_MS = 6_000;
const COMMUNITY_SURFACE_TIMEOUT_MS = 10_000;
const CAPITAL_FAST_TIMEOUT_MS = 6_000;

export type FundingIntentPayload = {
  intent: {
    id: string;
    blueprintId: string | null;
    communitySlug: string | null;
    programId: string | null;
    amountUsd: string;
    amountUsdcMicro: string;
    status: string;
    returnTo: string | null;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
    transaction: {
      txHash: string | null;
      status: string;
      providerTransactionId: string | null;
    } | null;
  };
};

export type SettlementBatchPayload = {
  batch: {
    id: string;
    communitySlug: string | null;
    status: string;
    totalUsd: string;
    totalUsdcMicro: string;
    payeeCount: number;
    programId: string | null;
    policyVersionId: string | null;
    simulationId: string | null;
    packageHash: string | null;
    evidenceRootHash: string | null;
    preparedAt: string;
    submittedAt: string | null;
    confirmedAt: string | null;
    returnTo: string | null;
    transactions: Array<{
      id: string;
      providerTransactionId: string | null;
      txHash: string | null;
      status: string;
      failureCode: string | null;
      failureMessage: string | null;
      amountUsdcMicro: string | null;
    }>;
  };
  execution: { enabled: boolean; blocker: string | null };
};

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
    queryFn: ({ signal }) =>
      fetchJsonWithTimeout(
        "/api/profile/bootstrap?fast=1",
        PROFILE_FAST_TIMEOUT_MS,
        signal,
      ),
    staleTime: 60_000,
    gcTime: 300_000,
    placeholderData: (prev) => prev,
    retry: 1,
    retryDelay: 800,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useUserConnectionsQuery(
  enabled: boolean,
  initialData?: UserConnectionState | null,
) {
  return useQuery({
    queryKey: queryKeys.profileState,
    enabled,
    initialData: initialData?.signedIn ? initialData : undefined,
    placeholderData: (prev) => prev ?? (initialData?.signedIn ? initialData : undefined),
    queryFn: async ({ signal }) => {
      try {
        return await fetchJsonWithTimeout<UserConnectionState & { ok?: boolean }>(
          "/api/profile/state?fast=1",
          PROFILE_FAST_TIMEOUT_MS,
          signal,
        );
      } catch {
        if (initialData?.signedIn) return initialData;
        return { ok: false, ...emptyConnectionState() };
      }
    },
    staleTime: 45_000,
    gcTime: 300_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useDiscoverRadarFeedQuery(limit = 24) {
  return useQuery({
    queryKey: queryKeys.discoverRadarFeed(limit),
    queryFn: ({ signal }) => discoverRadarFeedQueryFn(limit, signal),
    staleTime: 90_000,
    gcTime: 300_000,
    placeholderData: undefined,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_500 * 2 ** attempt, 6_000),
    refetchOnMount: "always",
  });
}

export function useCapitalWalletQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.capitalState,
    enabled,
    queryFn: ({ signal }) =>
      fetchJsonWithTimeout<CapitalStateResponse>(
        "/api/capital/state?fast=1",
        CAPITAL_FAST_TIMEOUT_MS,
        signal,
      ),
    staleTime: 30_000,
    gcTime: 300_000,
    placeholderData: (prev) => prev,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useCapitalStateQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.capitalState,
    enabled,
    queryFn: ({ signal }) =>
      fetchJsonWithTimeout<CapitalStateResponse>(
        "/api/capital/state?fast=1",
        CAPITAL_FAST_TIMEOUT_MS,
        signal,
      ),
    staleTime: 30_000,
    refetchOnMount: false,
    gcTime: 300_000,
    placeholderData: (prev) => prev,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useFundingIntentQuery(id: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.fundingIntent(id ?? "missing"),
    enabled: enabled && Boolean(id),
    queryFn: ({ signal }) =>
      fetchJsonWithTimeout<FundingIntentPayload>(
        `/api/capital/funding-intents/${encodeURIComponent(id!)}`,
        CAPITAL_FAST_TIMEOUT_MS,
        signal,
      ),
    staleTime: 10_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useSettlementBatchQuery(
  id: string | null | undefined,
  returnTo: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.settlementBatch(id ?? "missing"),
    enabled: enabled && Boolean(id),
    queryFn: ({ signal }) => {
      const suffix = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
      return fetchJsonWithTimeout<SettlementBatchPayload>(
        `/api/capital/settlement-batches/${encodeURIComponent(id!)}${suffix}`,
        CAPITAL_FAST_TIMEOUT_MS,
        signal,
      );
    },
    staleTime: 5_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function prefetchDiscoverTab(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.discoverRadarFeed(24),
    queryFn: () => discoverRadarFeedQueryFn(24),
    staleTime: 90_000,
  });
}

export function prefetchCommunitiesTab(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.communities,
    queryFn: () => fetchJsonWithTimeout("/api/communities", COMMUNITY_HUB_TIMEOUT_MS),
    staleTime: 90_000,
  });
}

export function prefetchWalletAndConnections(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.capitalState,
    queryFn: () =>
      fetchJsonWithTimeout<CapitalStateResponse>(
        "/api/capital/state?fast=1",
        CAPITAL_FAST_TIMEOUT_MS,
      ),
    staleTime: 30_000,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.profileState,
    queryFn: () =>
      fetchJsonWithTimeout<UserConnectionState & { ok?: boolean }>(
        "/api/profile/state?fast=1",
        PROFILE_FAST_TIMEOUT_MS,
      ),
    staleTime: 45_000,
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
    staleTime: 90_000,
    gcTime: 600_000,
    placeholderData: (prev) => prev,
    retry: 1,
    retryDelay: 800,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
    queryFn: () =>
      fetchJsonWithTimeout("/api/profile/bootstrap?fast=1", PROFILE_FAST_TIMEOUT_MS),
    staleTime: 90_000,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.profileState,
    queryFn: () =>
      fetchJsonWithTimeout("/api/profile/state?fast=1", PROFILE_FAST_TIMEOUT_MS),
    staleTime: 90_000,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.profileWork,
    queryFn: ({ signal }) =>
      fetchJsonWithTimeout("/api/profile/work", PROFILE_BOOTSTRAP_TIMEOUT_MS, signal),
    staleTime: 90_000,
  });
}
