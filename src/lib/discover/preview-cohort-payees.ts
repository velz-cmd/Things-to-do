import { COHORT_POOL_SIZE } from "../earn/discover-eligibility";

export type PreviewCohortMember = {
  name: string;
  work: string;
  /** Relative eligibility weight — higher verified impact → larger share of milestone. */
  weight: number;
};

const REACT_BATCH: PreviewCohortMember[] = [
  { name: "Maya Okonkwo", work: "Hooks reference rewrite", weight: 1.0 },
  { name: "Jonas Petrov", work: "Tutorial: concurrent rendering", weight: 1.15 },
  { name: "Elena Vasquez", work: "API docs for use()", weight: 1.3 },
  { name: "Chris Nakamura", work: "Changelog + migration notes", weight: 1.45 },
  { name: "Aisha Rahman", work: "Examples: server components", weight: 1.6 },
  { name: "Tomás Silva", work: "i18n: Spanish docs pass", weight: 1.75 },
  { name: "Priya Menon", work: "Typo sweep · 140 pages", weight: 1.9 },
  { name: "David Kim", work: "Docs PR review · accessibility", weight: 2.1 },
  { name: "Rachel O'Brien", work: "Maintainer review · API surface", weight: 2.35 },
  { name: "Sam Adeyemi", work: "Onboarding guide + diagrams", weight: 2.6 },
];

const LINUX_BATCH: PreviewCohortMember[] = [
  { name: "Linus Torvalds*", work: "Kernel release coordination", weight: 2.8 },
  { name: "Greg Kroah-Hartman*", work: "Stable branch merges", weight: 2.5 },
  { name: "Kees Cook", work: "Security hardening patch", weight: 2.0 },
  { name: "Shuah Khan", work: "Driver subsystem fix", weight: 1.7 },
  { name: "Jonathan Corbet", work: "LWN docs / kernel news", weight: 1.5 },
  { name: "Anna Morris", work: "Backport for LTS 6.6", weight: 1.35 },
  { name: "Wei Zhang", work: "CVE triage response", weight: 1.25 },
  { name: "Carlos Mendez", work: "Build system maintainer", weight: 1.15 },
  { name: "Ingrid Holm", work: "Arch test matrix fix", weight: 1.05 },
  { name: "Omar Hassan", work: "Release packaging helper", weight: 1.0 },
];

const JELLYFIN_BATCH: PreviewCohortMember[] = [
  { name: "Nina Bergström", work: "Plugin: intro skip markers", weight: 1.0 },
  { name: "Marcus Lee", work: "Theme pack · living room UI", weight: 1.2 },
  { name: "Yuki Tanaka", work: "Subtitle timing fixes", weight: 1.35 },
  { name: "Felipe Costa", work: "Library admin · 12k items", weight: 1.5 },
  { name: "Hannah Weiss", work: "Metadata enrichment pass", weight: 1.65 },
  { name: "Alex Rivera", work: "Transcode path testing", weight: 1.8 },
  { name: "Sofia Marchetti", work: "Docs: remote access", weight: 1.95 },
  { name: "Ben Okafor", work: "Italian UI translation", weight: 2.1 },
  { name: "Claire Dubois", work: "Community support mod", weight: 2.25 },
  { name: "Diego Morales", work: "Watch-time analytics hook", weight: 2.5 },
];

const NAVIDROME_BATCH: PreviewCohortMember[] = [
  { name: "Luna Hart", work: "842 plays · indie EP", weight: 1.0 },
  { name: "The Midnight Echoes", work: "Session royalties · 3 tracks", weight: 1.2 },
  { name: "Composer: A. Volkov", work: "Film cue placements", weight: 1.4 },
  { name: "Blue Note Collective", work: "Label pool · 5 artists", weight: 1.55 },
  { name: "DJ Prism", work: "Remix pack · verified plays", weight: 1.7 },
  { name: "Mira Solis", work: "Cover album · 1.2k listens", weight: 1.85 },
  { name: "Curator: K. Okon", work: "Playlist · 400 followers", weight: 2.0 },
  { name: "Live at Red Room", work: "Concert recording split", weight: 2.15 },
  { name: "Podcast: Signal Drift", work: "Episode royalty block", weight: 2.3 },
  { name: "Engineer: P. Walsh", work: "Mastering · 9 releases", weight: 2.5 },
];

const INDEPENDENT_MUSIC_BATCH = NAVIDROME_BATCH;

const OPEN_RESEARCH_BATCH: PreviewCohortMember[] = [
  { name: "Dr. Amara Singh", work: "Lead author · 2.1k citations", weight: 2.6 },
  { name: "Prof. James Liu", work: "Co-author · methods section", weight: 2.2 },
  { name: "Dr. Fatima Al-Hassan", work: "Dataset curator · DOI bundle", weight: 1.9 },
  { name: "Open Review: Chen", work: "Peer review · 3 rounds", weight: 1.7 },
  { name: "Dr. Eva Novak", work: "Cited replication study", weight: 1.55 },
  { name: "Lab: Rivera Group", work: "Shared instrumentation", weight: 1.4 },
  { name: "Fig. author: Park", work: "Visualization pipeline", weight: 1.25 },
  { name: "Editor: M. Sullivan", work: "Copyedit · grant appendix", weight: 1.15 },
  { name: "Grad: T. Osei", work: "Replication package", weight: 1.05 },
  { name: "Crossref: DOI mint", work: "Attribution anchor", weight: 1.0 },
];

const BATCH_BY_SLUG: Record<string, PreviewCohortMember[]> = {
  react: REACT_BATCH,
  linux: LINUX_BATCH,
  jellyfin: JELLYFIN_BATCH,
  navidrome: NAVIDROME_BATCH,
  "independent-music": INDEPENDENT_MUSIC_BATCH,
  "open-research": OPEN_RESEARCH_BATCH,
};

/** Split a milestone pool across payees — sums exactly to totalUsd (2 decimal places). */
export function distributeMilestoneUsd(
  members: PreviewCohortMember[],
  totalUsd: number,
): Array<{ label: string; owedUsd: number }> {
  const weights = members.map((m) => m.weight);
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (weightSum <= 0 || totalUsd <= 0) return [];

  const raw = members.map((m) => (m.weight / weightSum) * totalUsd);
  const floored = raw.map((n) => Math.floor(n * 100) / 100);
  let remainder = Math.round((totalUsd - floored.reduce((s, a) => s + a, 0)) * 100);

  const order = raw
    .map((n, i) => ({ i, frac: n * 100 - Math.floor(n * 100) }))
    .sort((a, b) => b.frac - a.frac);

  const amounts = [...floored];
  for (const { i } of order) {
    if (remainder <= 0) break;
    amounts[i] = Math.round((amounts[i]! + 0.01) * 100) / 100;
    remainder -= 1;
  }

  return members.map((m, i) => ({
    label: `${m.name} — ${m.work}`,
    owedUsd: amounts[i]!,
  }));
}

/** Next $500 milestone batch — real names, variable shares, full milestone total. */
export function buildPreviewCohortPayees(
  slug: string,
  milestoneUsd = 500,
  batchSize = COHORT_POOL_SIZE,
): Array<{ label: string; owedUsd: number }> {
  const members = (BATCH_BY_SLUG[slug] ?? REACT_BATCH).slice(0, batchSize);
  return distributeMilestoneUsd(members, milestoneUsd);
}
