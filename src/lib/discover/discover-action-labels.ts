import type { DiscoverAction } from "@/lib/discover/types";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";

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
  if (!slug) return "community";
  return COMMUNITY_NAMES[slug] ?? slug.replace(/-/g, " ");
}

/** User-facing action labels — never expose raw sensor / connector setup copy. */
export function friendlyDiscoverActionLabel(
  action: DiscoverAction,
  state?: UserConnectionState | null,
): string {
  if (state?.signedIn && action.communitySlug) {
    const installed = state.installedCommunitySlugs.includes(action.communitySlug);
    if (installed && (action.kind === "install" || action.kind === "connect_sensor")) {
      return `Open ${communityTitle(action.communitySlug)}`;
    }
    if (state.hasAnyConnector && action.kind === "install") {
      return `Explore ${communityTitle(action.communitySlug)}`;
    }
  }

  if (action.kind === "connect_sensor") {
    if (action.communitySlug) return `Explore ${communityTitle(action.communitySlug)}`;
    return "Explore opportunity";
  }

  const raw = action.label.trim();
  if (/connect\s+(sensor|github|jellyfin|listenbrainz|openalex)/i.test(raw)) {
    if (action.communitySlug) return `Explore ${communityTitle(action.communitySlug)}`;
    return "Explore program";
  }
  if (/github sensor/i.test(raw)) return action.communitySlug ? `Explore ${communityTitle(action.communitySlug)}` : "Explore maintainers";
  if (/music sensor/i.test(raw)) return "Explore royalties";
  if (/openalex sensor/i.test(raw)) return "Explore research";

  return raw;
}
