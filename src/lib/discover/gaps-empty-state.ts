import { COMMUNITY_CATALOG, type CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { DiscoverAction } from "@/lib/discover/types";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import { classifyBoardNeedType } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { boardCommunityActions } from "@/lib/discover/board-actions-for-role";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";

/** What the Unpaid Value lane shows. */
export const GAPS_TAB_INTRO =
  "Verified activity that is not earning yet — ranked by what you can fund or rule next.";

export function gapsRoleIntro(role: DiscoverRole): string {
  const copy: Partial<Record<DiscoverRole, string>> = {
    funder:
      "No ledger-ranked unpaid value yet. Set up a community, connect a source, and create a payout rule.",
    founder:
      "No unpaid value ranked yet. Set up your community and launch a payout program.",
    operator:
      "No ranked value yet. Connect GitHub, ListenBrainz, or Jellyfin on Profile to extract activity.",
    dao: "No citation or grant gaps yet. Set up Open Research and launch a QF round.",
    community:
      "No ranked unpaid value on the ledger yet. Set up OSS, research, or music programs below.",
    all: "No unpaid value ranked yet — set up a community on the Funding board to unlock more rows.",
  };
  return copy[role] ?? copy.all!;
}

const BALANCED_ATTACH_SLUGS = [
  "react",
  "linux",
  "jellyfin",
  "navidrome",
  "independent-music",
  "open-research",
] as const;

const KIND_BY_NEED: Partial<Record<DiscoverNeedTypeFilter, CommunityCatalogEntry["kind"][]>> = {
  artists: ["music"],
  researchers: ["research"],
  docs: ["oss", "education"],
  reviewers: ["oss"],
  translators: ["education", "oss"],
  grants: ["research"],
  moderators: ["music", "oss", "education"],
};

function templateForKind(kind: CommunityCatalogEntry["kind"]): string {
  if (kind === "music") return "user-centric-royalties";
  if (kind === "media") return "video-royalties";
  if (kind === "research") return "citation-toll";
  return "docs-bounty";
}

function catalogForContext(input: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
  installedSlugs?: string[];
}): CommunityCatalogEntry[] {
  const installed = new Set(input.installedSlugs ?? []);
  const candidates: CommunityCatalogEntry[] = [];

  for (const slug of BALANCED_ATTACH_SLUGS) {
    const entry = COMMUNITY_CATALOG.find((c) => c.slug === slug);
    if (entry && !installed.has(slug)) candidates.push(entry);
  }

  if (input.needType !== "all") {
    const kinds = new Set(KIND_BY_NEED[input.needType] ?? []);
    const filtered = candidates.filter((c) => kinds.has(c.kind));
    if (filtered.length) return filtered.slice(0, 3);
  }

  if (candidates.length >= 2) return candidates.slice(0, 3);

  for (const entry of COMMUNITY_CATALOG.filter((c) => c.featured)) {
    if (candidates.length >= 3) break;
    if (installed.has(entry.slug)) continue;
    if (candidates.some((c) => c.slug === entry.slug)) continue;
    candidates.push(entry);
  }

  return candidates.slice(0, 3);
}

export function gapsPrimaryActions(input: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
  installedSlugs?: string[];
  connections?: UserConnectionState | null;
}): DiscoverAction[] {
  const entries = catalogForContext(input);
  const installed = new Set(input.installedSlugs ?? []);
  const actions: DiscoverAction[] = [];
  const seen = new Set<string>();
  const actionRole =
    input.role === "all" || input.role === "community" ? "funder" : input.role;

  for (const entry of entries) {
    const templateId = templateForKind(entry.kind);
    const needType = classifyBoardNeedType({
      templateId,
      communitySlug: entry.slug,
      boardKind: "community",
      whyFund: entry.tagline,
      programName: entry.name,
    });
    const isInstalled = installed.has(entry.slug);
    const rowActions = boardCommunityActions(actionRole, {
      communitySlug: entry.slug,
      templateId,
      needType,
      communityName: entry.name,
      installed: isInstalled || communityReadyForDiscover(entry.slug, input.connections),
      connections: input.connections,
    });
    for (const action of rowActions.slice(0, 3)) {
      const key = `${action.kind}:${action.communitySlug}:${action.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      actions.push(action);
    }
  }

  return actions.slice(0, 6);
}

export function gapsExploreActions(input: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
  installedSlugs?: string[];
}): DiscoverAction[] {
  return gapsPrimaryActions(input);
}

export function gapsExploreCommunities(input: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
  installedSlugs?: string[];
}): CommunityCatalogEntry[] {
  return catalogForContext(input);
}

export function unpaidValueTitleForSlug(slug: string, fallbackName: string): string {
  return getCommunityValueProfile(slug)?.unpaidTitle ?? fallbackName;
}
