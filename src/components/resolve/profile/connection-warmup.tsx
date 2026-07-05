"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { queryKeys } from "@/lib/query/keys";
import { prefetchCommunitiesTab, prefetchDiscoverTab } from "@/lib/query/hooks";

/** Warm Profile + Communities + Discover caches as soon as the user is signed in. */
export function ConnectionWarmup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    void queryClient.prefetchQuery({
      queryKey: queryKeys.profileState,
      queryFn: async () => {
        const res = await fetch("/api/profile/state", { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error("profile_state_failed");
        return res.json();
      },
      staleTime: 10_000,
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.profileBootstrap,
      queryFn: async () => {
        const res = await fetch("/api/profile/bootstrap", { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error("profile_bootstrap_failed");
        return res.json();
      },
      staleTime: 15_000,
    });

    prefetchCommunitiesTab(queryClient);
    prefetchDiscoverTab(queryClient);
  }, [user, queryClient]);

  return null;
}
