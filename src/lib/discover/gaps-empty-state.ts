import { COMMUNITY_CATALOG, type CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { DiscoverAction } from "@/lib/discover/types";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import { classifyBoardNeedType } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { boardCommunityActions } from "@/lib/discover/board-actions-for-role";

/** What the Gaps lane shows — funder-facing ranked opportunities. */
export const GAPS_TAB_INTRO =
  "Unfunded authorizations from real upstream activity — ranked by opportunity score.";

export function gapsRoleIntro(role: DiscoverRole): string {
  const copy: Partial<Record<DiscoverRole, string>> = {
    funder:
      "No ledger gaps ranked yet. Attach a community and fund a program — authorizations appear here when sensors sync.",
    founder:
      "No gaps yet. Install your community and launch a program — maintainer and play events rank here.",
    operator:
      "No gaps yet. Connect sensors on Profile — verified work surfaces automatically.",
    dao: "No grant or citation gaps yet. Launch a QF round or attach Open Research.",
    community:
      "No ranked gaps on the ledger yet. Profile connectors (GitHub, ListenBrainz, Jellyfin) are separate from community attach — attach OSS, research, or music programs below.",
    all: "No ledger gaps ranked yet — attach a community on Board to unlock ranked opportunities across the catalog.",
  };
  return copy[role] ?? copy.all!;
}

/** Balanced attach suggestions — OSS, research, music, video with live sensors. */
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

/** Up to three attach/console actions — skips already-attached communities. */
export function gapsPrimaryActions(input: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
  installedSlugs?: string[];
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
      installed: isInstalled,
    });
    for (const action of rowActions.slice(0, 2)) {
      const key = `${action.kind}:${action.communitySlug}:${action.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      actions.push(action);
    }
  }

  return actions.slice(0, 5);
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
