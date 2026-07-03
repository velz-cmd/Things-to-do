import type { DiscoverAction } from "@/lib/discover/types";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import { communityConsolePath } from "@/lib/communities/community-nav";

const COMMUNITY_NAMES: Record<string, string> = {
  react: "React",
  linux: "Linux",
  navidrome: "Navidrome",
  "independent-music": "Independent Music",
  "open-research": "Open Research",
  jellyfin: "Jellyfin",
  "open-writers": "Open Writers",
};

function communityTitle(slug?: string): string {
  if (!slug) return "program";
  return COMMUNITY_NAMES[slug] ?? slug.replace(/-/g, " ");
}

/** Profile-linked users skip repeat setup — actions run on Discover. */
export function tailorDiscoverActionsForUser(
  actions: DiscoverAction[],
  state: UserConnectionState | null | undefined,
): DiscoverAction[] {
  if (!state?.signedIn) return actions;

  return actions
    .map((action) => {
      const slug = action.communitySlug;
      const ready = slug ? communityReadyForDiscover(slug, state) : false;

      if ((action.kind === "install" || action.kind === "connect_sensor") && ready && slug) {
        return null;
      }

      if (action.kind === "connect_sensor") {
        return {
          ...action,
          href: "/profile",
          label: action.label.replace(/^Connect\s+/i, "Link "),
        };
      }

      if (action.kind === "install" && ready && slug) {
        return {
          ...action,
          kind: "open",
          label: `Operate ${communityTitle(slug)}`,
          href: communityConsolePath(slug),
        };
      }

      if (action.kind === "console" && slug) {
        return {
          ...action,
          kind: "open",
          label: action.label || `Operate ${communityTitle(slug)}`,
          href: communityConsolePath(slug),
        };
      }

      return action;
    })
    .filter((action): action is DiscoverAction => action != null);
}

export function friendlyDiscoverActionLabelForUser(
  action: DiscoverAction,
  state: UserConnectionState | null | undefined,
): string {
  const slug = action.communitySlug;
  if (state?.signedIn && slug && communityReadyForDiscover(slug, state)) {
    if (action.kind === "console" || (action.kind === "open" && action.href?.includes("/communities/"))) {
      return action.label || `Operate ${communityTitle(slug)}`;
    }
  }

  return action.label.trim();
}
