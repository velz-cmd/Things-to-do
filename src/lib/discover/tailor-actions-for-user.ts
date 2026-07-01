import type { DiscoverAction } from "@/lib/discover/types";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { isCommunityInstalled } from "@/lib/profile/connection-state-types";

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

/** Rewrite install/connect actions when user already has communities or identities linked. */
export function tailorDiscoverActionsForUser(
  actions: DiscoverAction[],
  state: UserConnectionState | null | undefined,
): DiscoverAction[] {
  if (!state?.signedIn) return actions;

  return actions.map((action) => {
    const slug = action.communitySlug;
    const installed = isCommunityInstalled(state, slug);

    if ((action.kind === "install" || action.kind === "connect_sensor") && installed && slug) {
      return {
        ...action,
        kind: "console",
        label: `Open ${communityTitle(slug)} console`,
        href: undefined,
        reason: "Already attached — opens console on Discover",
      };
    }

    if (action.kind === "install" && state.hasAnyConnector && slug && !installed) {
      return action;
    }

    return action;
  });
}

export function friendlyDiscoverActionLabelForUser(
  action: DiscoverAction,
  state: UserConnectionState | null | undefined,
): string {
  const slug = action.communitySlug;
  if (state?.signedIn && slug && isCommunityInstalled(state, slug)) {
    if (action.kind === "install" || action.kind === "connect_sensor") {
      return `Open ${communityTitle(slug)} console`;
    }
    if (action.kind === "console") {
      return action.label || `Open ${communityTitle(slug)} console`;
    }
  }

  if (action.kind === "install" && state?.hasAnyConnector) {
    return slug ? `Attach ${communityTitle(slug)}` : "Attach community";
  }

  const raw = action.label.trim();
  if (/install community/i.test(raw) && state?.hasAnyConnector) {
    return slug ? `Attach ${communityTitle(slug)}` : "Attach community";
  }

  return raw;
}
