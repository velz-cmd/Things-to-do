import { COMMUNITY_CATALOG, type CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { DiscoverAction } from "@/lib/discover/types";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";

/** What the Gaps lane shows — value first, no connector setup jargon. */
export const GAPS_TAB_INTRO =
  "Unfunded work the network can recognize — maintainer programs, royalty pools, docs bounties, grant rounds, and citation tolls. RESOLVE surfaces opportunities here; sources sync in the background.";

export const GAPS_TAB_EXAMPLES = [
  "Docs bounty on a maintainer repo",
  "Artist royalties from verified plays",
  "Citation toll on open research",
  "Security reviewer pool for a commons",
] as const;

export function gapsEmptyMessage(needType: DiscoverNeedTypeFilter): string {
  if (needType !== "all") {
    return `No ${needType} gaps ranked yet. Browse live community programs below — tap Explore to open one in Discover.`;
  }
  return "No ranked gaps yet. Explore a community program below — your connected sources sync automatically in the background.";
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

  return rows.slice(0, 4);
}

export function gapsExploreActions(input: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
}): DiscoverAction[] {
  return catalogForContext(input).map((entry) => ({
    id: `explore-${entry.slug}`,
    label: entry.installCta.replace(/^Install on /i, "Explore "),
    kind: "install" as const,
    communitySlug: entry.slug,
  }));
}

export function gapsExploreCommunities(input: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
}): CommunityCatalogEntry[] {
  return catalogForContext(input);
}
