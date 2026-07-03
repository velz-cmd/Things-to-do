import type { DiscoverAction } from "@/lib/discover/types";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";

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

/** User-facing action labels — no engineer or hackathon jargon. */
export function friendlyDiscoverActionLabel(
  action: DiscoverAction,
  state?: UserConnectionState | null,
): string {
  if (state?.signedIn && action.communitySlug && communityReadyForDiscover(action.communitySlug, state)) {
    if (action.kind === "console") {
      return action.label || `Open ${communityTitle(action.communitySlug)}`;
    }
  }

  if (action.kind === "connect_sensor") {
    return "Connect source";
  }

  if (action.kind === "install" || action.kind === "create_program") {
    if (/reward program|bounty|pool/i.test(action.label)) return action.label;
    return action.communitySlug ? "Create reward program" : "Create reward program";
  }

  if (action.kind === "automate") {
    return action.label.trim() || "Automate payouts";
  }

  if (action.kind === "analyze") {
    return action.label.trim() || "Run analysis";
  }

  if (action.kind === "console") {
    return action.label.trim() || (action.communitySlug ? `Open ${communityTitle(action.communitySlug)}` : "Open community");
  }

  return action.label.trim();
}
