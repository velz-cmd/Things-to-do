import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";

export type GapSensorLink = {
  label: string;
  href: string;
  hint: string;
};

/** What the Gaps lane shows — shown before pushing sensor setup. */
export const GAPS_TAB_INTRO =
  "Unfunded work the network can already recognize — maintainer programs, royalty pools, docs bounties, grant rounds, and citation tolls. Verified gaps appear here after community sensors sync to the ledger.";

export const GAPS_TAB_EXAMPLES = [
  "Docs bounty on a maintainer repo",
  "Artist royalties from verified plays",
  "Citation toll on open research",
  "Security reviewer pool for a commons",
] as const;

export function gapsEmptyMessage(needType: DiscoverNeedTypeFilter): string {
  if (needType !== "all") {
    return `No ${needType} gaps in the ledger yet. Browse communities below and connect the sensors that match your work.`;
  }
  return "No verified gaps yet. Explore what each community tracks, then connect the sensors that fit your ecosystem.";
}

/** Community-specific sensor paths — not GitHub-only. */
export function gapsConnectLinks(input: {
  needType: DiscoverNeedTypeFilter;
  role: DiscoverRole;
}): GapSensorLink[] {
  const { needType, role } = input;

  if (needType === "artists" || role === "community") {
    return [
      {
        label: "Independent Music",
        href: "/communities/independent-music",
        hint: "ListenBrainz · MusicBrainz",
      },
      {
        label: "Navidrome",
        href: "/communities/navidrome",
        hint: "Self-hosted plays",
      },
    ];
  }

  if (needType === "researchers" || needType === "grants" || role === "dao") {
    return [
      {
        label: "Open Research",
        href: "/communities/open-research",
        hint: "OpenAlex · Crossref",
      },
      {
        label: "Browse communities",
        href: "/communities",
        hint: "Grant pools · QF",
      },
    ];
  }

  if (needType === "docs" || needType === "reviewers" || needType === "translators") {
    return [
      { label: "React", href: "/communities/react", hint: "GitHub · maintainers" },
      { label: "Linux", href: "/communities/linux", hint: "Security · docs" },
    ];
  }

  if (needType === "moderators" || needType === "automation") {
    return [
      { label: "Browse communities", href: "/communities", hint: "Install programs" },
      { label: "Mission agent signals", href: "/mission", hint: "Pay-per-signal" },
    ];
  }

  if (role === "founder" || role === "operator") {
    return [
      { label: "React", href: "/communities/react", hint: "OSS · GitHub" },
      { label: "Independent Music", href: "/communities/independent-music", hint: "Music" },
      { label: "Open Research", href: "/communities/open-research", hint: "Citations" },
    ];
  }

  return [
    { label: "React · OSS", href: "/communities/react", hint: "GitHub sensor" },
    { label: "Independent Music", href: "/communities/independent-music", hint: "Play proofs" },
    { label: "Open Research", href: "/communities/open-research", hint: "OpenAlex" },
    { label: "All communities", href: "/communities", hint: "Compare ecosystems" },
  ];
}
