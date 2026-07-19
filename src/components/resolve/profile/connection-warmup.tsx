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
