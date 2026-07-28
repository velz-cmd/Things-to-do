"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import {
  readConnectionSnapshot,
  writeConnectionSnapshot,
} from "@/lib/profile/connection-snapshot-client";
import {
  emptyConnectionState,
  type PlatformConnection,
  type UserConnectionState,
} from "@/lib/profile/connection-state-types";
import { queryKeys } from "@/lib/query/keys";

const RETURN_PARAMS = [
  "github_connected",
  "github_account",
  "github_installation",
  "github_repository_count",
  "github_error",
  "github_install_error",
];

function upsertPlatform(
  platforms: PlatformConnection[],
  incoming: PlatformConnection,
): PlatformConnection[] {
  const rows = platforms.filter((row) => row.id !== incoming.id);
  return [incoming, ...rows];
}

export function ConnectionReturnSync() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const serialized = searchParams.toString();

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(serialized);
    const connected = params.get("github_connected") === "1";
    const githubError = params.get("github_error");
    const installError = params.get("github_install_error");
    if (!connected && !githubError && !installError) return;

    if (connected) {
      const now = new Date().toISOString();
      const account = params.get("github_account");
      const installationConnected = params.get("github_installation") === "1";
      const repositoryCount = Number(params.get("github_repository_count") ?? "0");
      const current = readConnectionSnapshot(user.id);
      let state: UserConnectionState = current ?? {
        ...emptyConnectionState(),
        signedIn: true,
        userId: user.id,
        updatedAt: now,
      };
      let platforms = upsertPlatform(state.platforms, {
        id: "github",
        label: "GitHub",
        connected: true,
        displayValue: account ? `@${account}` : "Connected",
        username: account,
        lastSyncAt: now,
        syncStatus: "connected",
        authorizeUrl: "/connect/github",
      });
      if (installationConnected) {
        platforms = upsertPlatform(platforms, {
          id: "github_app",
          label: "GitHub repository access",
          connected: true,
          displayValue: `${Number.isFinite(repositoryCount) ? repositoryCount : 0} repositories`,
          lastSyncAt: now,
          syncStatus: "connected",
          authorizeUrl: "/connect/github/install",
        });
      }
      state = {
        ...state,
        signedIn: true,
        userId: user.id,
        updatedAt: now,
        lastSyncedAt: now,
        platforms,
        hasAnyConnector: true,
        githubUsername: account ?? state.githubUsername,
      };
      writeConnectionSnapshot(user.id, state);
      toast.success(
        installationConnected
          ? "GitHub repository access connected."
          : "GitHub identity connected.",
      );
    } else {
      toast.error(
        installError === "github_app_not_configured"
          ? "GitHub repository installation is not configured yet."
          : "GitHub connection could not be completed. You can retry safely.",
      );
    }

    void queryClient.invalidateQueries({ queryKey: queryKeys.profileState });
    void queryClient.invalidateQueries({ queryKey: queryKeys.userConnections });
    void queryClient.invalidateQueries({ queryKey: queryKeys.profileBootstrap });
    void queryClient.invalidateQueries({ queryKey: queryKeys.discoverRadarFeed(24) });

    RETURN_PARAMS.forEach((key) => params.delete(key));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, queryClient, router, serialized, user]);

  return null;
}
