"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { useUserConnectionsQuery } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { emptyConnectionState } from "@/lib/profile/connection-state-types";

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
  const query = useUserConnectionsQuery(Boolean(user));

  const state = useMemo((): UserConnectionState => {
    if (!user) return emptyConnectionState();
    const body = query.data as (UserConnectionState & { ok?: boolean }) | undefined;
    if (!body?.signedIn) return emptyConnectionState();
    return body;
  }, [user, query.data]);

  const reload = useCallback(() => {
    void query.refetch();
  }, [query]);

  const refreshSync = useCallback(async () => {
    if (!user) return;
    await fetch("/api/profile/connections", {
      method: "POST",
      credentials: "include",
    });
    await queryClient.invalidateQueries({ queryKey: queryKeys.userConnections });
    await queryClient.invalidateQueries({ queryKey: queryKeys.profileBootstrap });
    void query.refetch();
  }, [user, queryClient, query]);

  return (
    <UserConnectionsContext.Provider
      value={{
        state,
        loading: query.isLoading && Boolean(user),
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
