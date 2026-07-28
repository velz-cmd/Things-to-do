"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { queryKeys } from "@/lib/query/keys";
import { prefetchCommunitiesTab, prefetchWalletAndConnections } from "@/lib/query/hooks";
import { readJsonResponse } from "@/lib/api/client-json";

/** Warm wallet, profile connections, and Communities caches at sign-in. */
export function ConnectionWarmup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    prefetchWalletAndConnections(queryClient);
    prefetchCommunitiesTab(queryClient);
  }, [user, queryClient]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    let requestTimeout: number | undefined;
    const timer = window.setTimeout(() => {
      requestTimeout = window.setTimeout(() => controller.abort(), 12_000);
      void fetch("/api/connectors/github/installation/status", {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => {
          if (!body?.connected) return;
          void queryClient.invalidateQueries({ queryKey: queryKeys.profileState });
          void queryClient.invalidateQueries({ queryKey: queryKeys.userConnections });
          void queryClient.invalidateQueries({ queryKey: queryKeys.profileBootstrap });
          void queryClient.invalidateQueries({ queryKey: queryKeys.discoverRadarFeed(24) });
        })
        .catch(() => undefined)
        .finally(() => {
          if (requestTimeout) window.clearTimeout(requestTimeout);
        });
    }, 750);
    return () => {
      window.clearTimeout(timer);
      if (requestTimeout) window.clearTimeout(requestTimeout);
      controller.abort();
    };
  }, [user, queryClient]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/profile/state", { credentials: "include", cache: "no-store" }).then(
        async (res) => {
          const body = await readJsonResponse(res);
          queryClient.setQueryData(queryKeys.profileState, body);
        },
        () => undefined,
      );
    }, 3_000);
    return () => window.clearTimeout(timer);
  }, [user, queryClient]);

  return null;
}
