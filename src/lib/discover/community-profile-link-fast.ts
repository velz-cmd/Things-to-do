import type { User } from "@prisma/client";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { normalizeGithubLogin } from "@/lib/identity/github-login";
import {
  userJellyfinConfigured,
  userListenBrainzConfigured,
  userNavidromeConfigured,
} from "@/lib/profile/user-connections";

type ProfileLinkFields = Pick<
  User,
  | "githubUsername"
  | "listenbrainzUsername"
  | "jellyfinUrl"
  | "jellyfinUsername"
  | "jellyfinAccessToken"
  | "jellyfinPassword"
  | "navidromeUrl"
  | "navidromeUsername"
  | "navidromePassword"
  | "gmailConnected"
>;

/** Profile-only community readiness — no extra DB round-trips (Communities hub fast path). */
export function profileLinkedCommunitySlugsFromProfile(
  profile: ProfileLinkFields,
): string[] {
  const github = Boolean(normalizeGithubLogin(profile.githubUsername));
  const listenbrainz = userListenBrainzConfigured(profile);
  const navidrome = userNavidromeConfigured(profile);
  const jellyfin = userJellyfinConfigured(profile);

  return COMMUNITY_CATALOG.filter((c) => {
    switch (c.slug) {
      case "jellyfin":
        return jellyfin;
      case "navidrome":
        return navidrome || listenbrainz;
      case "independent-music":
        return listenbrainz;
      case "react":
      case "linux":
        return github;
      case "open-research":
        return github;
      default:
        return github || listenbrainz || navidrome || jellyfin || profile.gmailConnected;
    }
  }).map((c) => c.slug);
}
