export type ConnectionPlatformId =
  | "github"
  | "listenbrainz"
  | "jellyfin"
  | "navidrome"
  | "gmail"
  | "musicbrainz"
  | "wallet";

export type PlatformConnection = {
  id: ConnectionPlatformId;
  label: string;
  connected: boolean;
  displayValue?: string;
  authorizeUrl?: string;
};

export type UserConnectionState = {
  signedIn: boolean;
  userId?: string;
  updatedAt: string;
  lastSyncedAt: string | null;
  platforms: PlatformConnection[];
  installedCommunitySlugs: string[];
  hasAnyConnector: boolean;
  githubUsername: string | null;
};

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
