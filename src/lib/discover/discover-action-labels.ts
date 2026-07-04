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

function programActionLabel(templateId?: string): string {
  if (!templateId) return "Create payout rule";
  const labels: Record<string, string> = {
    "citation-toll": "Create Citation Toll",
    "docs-bounty": "Create Docs Program",
    "quadratic-funding": "Launch Grant Round",
    "security-fund": "Create Security Fund",
    "user-centric-royalties": "Create Royalty Pool",
    "video-royalties": "Create Pay-per-Minute Rule",
  };
  return labels[templateId] ?? "Create payout rule";
}

function agentActionLabel(action: DiscoverAction): string {
  const templateId = action.templateId ?? "";
  if (templateId === "citation-toll") return "Verify Citations";
  if (templateId === "security-fund") return "Analyze Security Work";
  if (templateId === "docs-bounty") return "Analyze Contributors";
  if (templateId === "user-centric-royalties") return "Run Attribution Agent";
  if (templateId === "video-royalties") return "Analyze Watch Time";
  if (/budget|impact|estimate/i.test(action.label)) return "Estimate Budget";
  return action.label.trim() || "Start analysis";
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
    return action.label.trim() || "Connect proof source";
  }

  if (action.kind === "install" || action.kind === "create_program") {
    if (action.kind === "install") return action.label.trim() || "Connect proof source";
    if (/reward program|bounty|pool|toll|rule|fund|grant/i.test(action.label)) return action.label;
    return programActionLabel(action.templateId);
  }

  if (action.kind === "automate") {
    return action.label.trim() || "Automate payouts";
  }

  if (action.kind === "analyze") {
    return agentActionLabel(action);
  }

  if (action.kind === "console") {
    return action.label.trim() || (action.communitySlug ? `Open ${communityTitle(action.communitySlug)}` : "Open community");
  }

  return action.label.trim();
}
