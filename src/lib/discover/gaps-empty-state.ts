import { COMMUNITY_CATALOG, type CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { DiscoverAction } from "@/lib/discover/types";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import { classifyBoardNeedType } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { boardCommunityActions } from "@/lib/discover/board-actions-for-role";

/** What the Gaps lane shows — funder-facing ranked opportunities. */
export const GAPS_TAB_INTRO =
  "Verified unfunded work from ledger and sensors — ranked by opportunity score. No attach-first previews mixed in here.";

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
      "Creators collect on Earnings, not Gaps. Switch to the Earnings tab or connect ListenBrainz on Profile.",
    all: "Pick a job above (Fund, Earn, Run…) so actions match who you are — then attach one community to unlock ranked gaps.",
  };
  return copy[role] ?? copy.all!;
}

const KIND_BY_NEED: Partial<Record<DiscoverNeedTypeFilter, CommunityCatalogEntry["kind"][]>> = {
  artists: ["music"],
  researchers: ["research"],
  docs: ["oss", "education"],
  reviewers: ["oss"],
  translators: ["education", "oss"],
  grants: ["research"],
  moderators: ["music", "oss", "education"],
};

const KIND_BY_ROLE: Partial<Record<DiscoverRole, CommunityCatalogEntry["kind"][]>> = {
  community: ["music", "media"],
  founder: ["oss", "education"],
  dao: ["research"],
  funder: ["oss", "music", "research"],
};

function catalogForContext(input: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
}): CommunityCatalogEntry[] {
  const kinds = new Set<CommunityCatalogEntry["kind"]>();
  if (input.needType !== "all") {
    for (const k of KIND_BY_NEED[input.needType] ?? []) kinds.add(k);
  }
  if (input.role !== "all") {
    for (const k of KIND_BY_ROLE[input.role] ?? []) kinds.add(k);
  }

  let rows = COMMUNITY_CATALOG.filter((c) => c.featured);
  if (kinds.size > 0) {
    const filtered = rows.filter((c) => kinds.has(c.kind));
    if (filtered.length) rows = filtered;
  }

  return rows.slice(0, 2);
}

/** At most two high-value attach actions for empty Gaps — role-specific, not a catalog grid. */
export function gapsPrimaryActions(input: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
}): DiscoverAction[] {
  const entries = catalogForContext(input);
  const actions: DiscoverAction[] = [];
  for (const entry of entries.slice(0, 2)) {
    const templateId =
      entry.kind === "music"
        ? "user-centric-royalties"
        : entry.kind === "media"
          ? "video-royalties"
          : entry.kind === "research"
            ? "citation-toll"
            : "docs-bounty";
    const needType = classifyBoardNeedType({
      templateId,
      communitySlug: entry.slug,
      boardKind: "community",
      whyFund: entry.tagline,
      programName: entry.name,
    });
    const rowActions = boardCommunityActions(input.role === "all" ? "funder" : input.role, {
      communitySlug: entry.slug,
      templateId,
      needType,
      communityName: entry.name,
    });
    actions.push(...rowActions.slice(0, 1));
  }
  return actions.slice(0, 2);
}

export function gapsExploreActions(input: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
}): DiscoverAction[] {
  return gapsPrimaryActions(input);
}

export function gapsExploreCommunities(input: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
}): CommunityCatalogEntry[] {
  return catalogForContext(input);
}
