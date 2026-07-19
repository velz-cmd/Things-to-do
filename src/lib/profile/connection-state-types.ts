export type ConnectionPlatformId =
  | "github"
  | "listenbrainz"
  | "jellyfin"
  | "navidrome"
  | "gmail"
  | "musicbrainz"
  | "wallet"
  | "payout"
  | "mastodon"
  | "peertube";

export type ConnectionSyncStatus =
  | "connected"
  | "syncing"
  | "stale"
  | "failed"
  | "reconnect_required"
  | "error"
  | "not_connected";

export type PlatformConnection = {
  id: ConnectionPlatformId;
  label: string;
  connected: boolean;
  displayValue?: string;
  providerUserId?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  lastSyncAt?: string | null;
  syncStatus?: ConnectionSyncStatus;
  error?: string | null;
  scopes?: string[];
  authorizeUrl?: string;
};

export type UserConnectionState = {
  signedIn: boolean;
  degraded?: boolean;
  error?: string;
  userId?: string;
  updatedAt: string;
  lastSyncedAt: string | null;
  platforms: PlatformConnection[];
  installedCommunitySlugs: string[];
  hasAnyConnector: boolean;
  githubUsername: string | null;
};

export function staleConnectionState(state: UserConnectionState): UserConnectionState {
  return {
    ...state,
    degraded: true,
    error: "profile_state_refresh_failed",
    platforms: state.platforms.map((platform) => ({
      ...platform,
      syncStatus: platform.connected ? "stale" : platform.syncStatus,
    })),
  };
}

export function emptyConnectionState(): UserConnectionState {
  return {
    signedIn: false,
    updatedAt: new Date().toISOString(),
    lastSyncedAt: null,
    platforms: [],
    installedCommunitySlugs: [],
    hasAnyConnector: false,
    githubUsername: null,
  };
}

export function isCommunityInstalled(
  state: UserConnectionState | null | undefined,
  slug?: string,
): boolean {
  if (!slug || !state?.signedIn) return false;
  return state.installedCommunitySlugs.includes(slug);
}

export function platformConnected(
  state: UserConnectionState | null | undefined,
  platform: ConnectionPlatformId,
): boolean {
  return Boolean(state?.platforms.find((p) => p.id === platform)?.connected);
}
