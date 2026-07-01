/** YouTube-style eligibility thresholds — estimates only, never ledger amounts. */

export type EarnEligibilityRule = {
  id: "oss" | "music" | "video" | "research";
  label: string;
  threshold: string;
  detail: string;
};

export const EARN_ELIGIBILITY_RULES: EarnEligibilityRule[] = [
  {
    id: "oss",
    label: "Open source",
    threshold: "5+ merged PRs or 100+ stars",
    detail: "GitHub contributions unlock maintainer programs and docs bounties.",
  },
  {
    id: "music",
    label: "Music",
    threshold: "1,000+ verified plays",
    detail: "ListenBrainz scrobbles with MusicBrainz attribution route royalties.",
  },
  {
    id: "video",
    label: "Video",
    threshold: "500+ verified watches",
    detail: "Jellyfin playback in funded programs credits creators.",
  },
  {
    id: "research",
    label: "Research",
    threshold: "10+ verified citations",
    detail: "OpenAlex citations unlock citation-toll programs.",
  },
];
