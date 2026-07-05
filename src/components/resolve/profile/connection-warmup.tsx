"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { queryKeys } from "@/lib/query/keys";
import { prefetchCommunitiesTab, prefetchWalletAndConnections } from "@/lib/query/hooks";

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
          if (!res.ok) return;
          const body = await res.json();
          queryClient.setQueryData(queryKeys.profileState, body);
        },
      );
    }, 3_000);
    return () => window.clearTimeout(timer);
  }, [user, queryClient]);

  return null;
}
