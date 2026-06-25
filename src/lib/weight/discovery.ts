import type { HiddenBuilder } from "@/lib/weight/types";

/** Discovery engine — overlooked contributors with measurable unpaid value. */
export const HIDDEN_BUILDERS: HiddenBuilder[] = [
  {
    id: "hb-001",
    name: "Lena Okonkwo",
    role: "Maintainer",
    platform: "github",
    handle: "lena-okonkwo",
    impactScore: 91,
    fundingReadiness: 88,
    unpaidUsdEstimate: 4200,
    headline: "4 repos · 680k monthly downloads · $0 received",
    signals: [
      { label: "PR merges (12mo)", value: "312", severity: "high" },
      { label: "Issue triage", value: "1.4k closed", severity: "high" },
      { label: "Downstream dependents", value: "680k/mo", severity: "high" },
      { label: "Funding received", value: "$0", severity: "high" },
    ],
  },
  {
    id: "hb-002",
    name: "Night Signals",
    role: "Musician",
    platform: "navidrome",
    handle: "mbid-night-signals",
    impactScore: 84,
    fundingReadiness: 79,
    unpaidUsdEstimate: 890,
    headline: "Top 3 artist on 12 self-hosted servers · no payee registry",
    signals: [
      { label: "Verified scrobbles (30d)", value: "14.2k", severity: "high" },
      { label: "Avg listen duration", value: "4m 12s", severity: "medium" },
      { label: "Registry status", value: "Unregistered", severity: "high" },
      { label: "Royalty received", value: "$0", severity: "high" },
    ],
  },
  {
    id: "hb-003",
    name: "Open Source Writer",
    role: "Fediverse creator",
    platform: "mastodon",
    handle: "@writer@fosstodon.org",
    impactScore: 78,
    fundingReadiness: 72,
    unpaidUsdEstimate: 1200,
    headline: "40% of instance engagement · zero campaign payouts",
    signals: [
      { label: "Engagement share", value: "40%", severity: "high" },
      { label: "Boosts / week", value: "2.1k", severity: "medium" },
      { label: "Campaign linked", value: "None", severity: "high" },
      { label: "Citations verified", value: "47", severity: "medium" },
    ],
  },
  {
    id: "hb-004",
    name: "Marcus Lee",
    role: "Photographer",
    platform: "immich",
    handle: "Marcus Lee",
    impactScore: 76,
    fundingReadiness: 81,
    unpaidUsdEstimate: 640,
    headline: "EXIF-tagged photos in 9 family libraries · never paid",
    signals: [
      { label: "Shared assets", value: "218", severity: "medium" },
      { label: "EXIF attribution", value: "100%", severity: "high" },
      { label: "Remix / share events", value: "89", severity: "medium" },
      { label: "Payout history", value: "$0", severity: "high" },
    ],
  },
  {
    id: "hb-005",
    name: "Alex Chen",
    role: "Designer",
    platform: "github",
    handle: "designer-alex",
    impactScore: 88,
    fundingReadiness: 85,
    unpaidUsdEstimate: 2400,
    headline: "Design system used by 3 hackathon winners · unpaid",
    signals: [
      { label: "PR acceptance rate", value: "94%", severity: "high" },
      { label: "Review depth", value: "High", severity: "medium" },
      { label: "Bounty completion", value: "0 paid", severity: "high" },
      { label: "Impact score", value: "88/100", severity: "high" },
    ],
  },
];

export function listHiddenBuilders(opts?: { minScore?: number; platform?: string }) {
  let list = [...HIDDEN_BUILDERS];
  if (opts?.minScore != null) list = list.filter((b) => b.impactScore >= opts.minScore!);
  if (opts?.platform) list = list.filter((b) => b.platform === opts.platform);
  return list.sort((a, b) => b.impactScore - a.impactScore);
}
