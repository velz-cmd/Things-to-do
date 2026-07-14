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
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { useUserConnectionsQuery } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { emptyConnectionState } from "@/lib/profile/connection-state-types";
import { PROFILE_REFRESH_EVENT } from "@/lib/profile/refresh-events";
import {
  readConnectionSnapshot,
  writeConnectionSnapshot,
  mergeConnectionStates,
  CONNECTION_SNAPSHOT_EVENT,
} from "@/lib/profile/connection-snapshot-client";

type UserConnectionsContextValue = {
  state: UserConnectionState;
  loading: boolean;
  refreshSync: () => Promise<void>;
  reload: () => void;
};

const UserConnectionsContext = createContext<UserConnectionsContextValue>({
  state: emptyConnectionState(),
  loading: false,
  refreshSync: async () => undefined,
  reload: () => undefined,
});

export function UserConnectionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [snapshotRevision, setSnapshotRevision] = useState(0);
  const snapshot = useMemo(
    () => (user ? readConnectionSnapshot(user.id) : null),
    [user, snapshotRevision],
  );

  const query = useUserConnectionsQuery(Boolean(user), snapshot);

  const state = useMemo((): UserConnectionState => {
    if (!user) return emptyConnectionState();
    const body = query.data as (UserConnectionState & { ok?: boolean }) | undefined;
    if (body?.signedIn) return snapshot?.signedIn ? mergeConnectionStates(snapshot, body) : body;
    if (snapshot?.signedIn) return snapshot;
    return emptyConnectionState();
  }, [user, query.data, snapshot]);

  useEffect(() => {
    if (!user) return;
    const refreshSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (!detail?.userId || detail.userId === user.id) setSnapshotRevision((value) => value + 1);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "resolve:connection-snapshot:v3") setSnapshotRevision((value) => value + 1);
    };
    window.addEventListener(CONNECTION_SNAPSHOT_EVENT, refreshSnapshot);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CONNECTION_SNAPSHOT_EVENT, refreshSnapshot);
      window.removeEventListener("storage", onStorage);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !query.data) return;
    const body = query.data as UserConnectionState & { ok?: boolean };
    if (body.signedIn) {
      writeConnectionSnapshot(user.id, body);
    }
  }, [user, query.data]);

  const reload = useCallback(() => {
    void query.refetch();
  }, [query]);

  useEffect(() => {
    const onProfileRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profileState });
      void queryClient.invalidateQueries({ queryKey: queryKeys.userConnections });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profileBootstrap });
      void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
      void queryClient.invalidateQueries({ queryKey: queryKeys.discoverRadarFeed(24) });
      void query.refetch();
    };
    window.addEventListener(PROFILE_REFRESH_EVENT, onProfileRefresh);
    return () => window.removeEventListener(PROFILE_REFRESH_EVENT, onProfileRefresh);
  }, [query, queryClient]);

  const refreshSync = useCallback(async () => {
    if (!user) return;
    await fetch("/api/profile/connections", {
      method: "POST",
      credentials: "include",
    });
    await queryClient.invalidateQueries({ queryKey: queryKeys.profileState });
    await queryClient.invalidateQueries({ queryKey: queryKeys.userConnections });
    await queryClient.invalidateQueries({ queryKey: queryKeys.profileBootstrap });
    await queryClient.invalidateQueries({ queryKey: queryKeys.communities });
    await queryClient.invalidateQueries({ queryKey: queryKeys.discoverRadarFeed(24) });
    void query.refetch();
  }, [user, queryClient, query]);

  return (
    <UserConnectionsContext.Provider
      value={{
        state,
        loading:
          Boolean(user) &&
          query.isLoading &&
          !snapshot?.signedIn &&
          !(query.data as UserConnectionState | undefined)?.signedIn,
        refreshSync,
        reload,
      }}
    >
      {children}
    </UserConnectionsContext.Provider>
  );
}

export function useUserConnections() {
  return useContext(UserConnectionsContext);
}

export function useUserConnectionsOptional() {
  return useContext(UserConnectionsContext);
}
