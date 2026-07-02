import type { UserConnectionState } from "../profile/connection-state-types";
import {
  isCommunityInstalled,
  platformConnected,
} from "../profile/connection-state-types";

/** True when Profile already links the upstream sources for this community. */
export function communityLinkedViaProfile(
  slug: string,
  state: UserConnectionState | null | undefined,
): boolean {
  if (!state?.signedIn) return false;
  if (isCommunityInstalled(state, slug)) return true;

  switch (slug) {
    case "jellyfin":
      return platformConnected(state, "jellyfin");
    case "navidrome":
      return (
        platformConnected(state, "navidrome") || platformConnected(state, "listenbrainz")
      );
    case "independent-music":
      return (
        platformConnected(state, "listenbrainz") || platformConnected(state, "musicbrainz")
      );
    case "react":
    case "linux":
      return Boolean(state.githubUsername);
    case "open-research":
      return platformConnected(state, "github");
    default:
      return state.hasAnyConnector;
  }
}

/** Treat Profile-linked communities as ready — no per-tab setup prompts. */
export function communityReadyForDiscover(
  slug: string | undefined,
  state: UserConnectionState | null | undefined,
): boolean {
  if (!slug) return false;
  return communityLinkedViaProfile(slug, state);
}
