import { COMMUNITY_CATALOG } from "../communities/catalog";
import type { UserConnectionState } from "../profile/connection-state-types";
import {
  isCommunityInstalled,
  platformConnected,
} from "../profile/connection-state-types";

/** Upstream sources in Profile satisfy this community (ignores DB install rows). */
export function communitySourcesLinkedViaProfile(
  slug: string,
  state: UserConnectionState | null | undefined,
): boolean {
  if (!state?.signedIn) return false;

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

/** True when Profile already links the upstream sources for this community. */
export function communityLinkedViaProfile(
  slug: string,
  state: UserConnectionState | null | undefined,
): boolean {
  if (!state?.signedIn) return false;
  if (isCommunityInstalled(state, slug)) return true;
  return communitySourcesLinkedViaProfile(slug, state);
}

/** Catalog slugs ready via Profile connectors (for shared connection state). */
export function profileLinkedCommunitySlugs(
  state: UserConnectionState | null | undefined,
): string[] {
  if (!state?.signedIn) return [];
  return COMMUNITY_CATALOG.filter((c) => communitySourcesLinkedViaProfile(c.slug, state)).map(
    (c) => c.slug,
  );
}

/** Treat Profile-linked communities as ready — no per-tab setup prompts. */
export function communityReadyForDiscover(
  slug: string | undefined,
  state: UserConnectionState | null | undefined,
): boolean {
  if (!slug) return false;
  return communityLinkedViaProfile(slug, state);
}
