/** Published eligibility thresholds — estimates only until ledger authorizes. */

import {
  MUSIC_MIN_PLAYS,
  MUSIC_PAYOUT_USD,
  OSS_MIN_MERGES,
  OSS_MIN_STARS,
  OSS_PAYOUT_USD,
  RESEARCH_MIN_VIEWS,
  RESEARCH_PAYOUT_USD,
  VIDEO_MIN_VIEWS,
  VIDEO_PAYOUT_USD,
  COHORT_POOL_SIZE,
} from "@/lib/earn/discover-eligibility";

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
    threshold: `${OSS_MIN_MERGES}+ merged PRs or ${OSS_MIN_STARS}+ stars → $${OSS_PAYOUT_USD}`,
    detail: `GitHub activity for React, Linux, and other OSS communities. Eligible maintainers batch into pools of ${COHORT_POOL_SIZE} before funding.`,
  },
  {
    id: "music",
    label: "Music",
    threshold: `${MUSIC_MIN_PLAYS.toLocaleString()}+ verified plays → $${MUSIC_PAYOUT_USD}`,
    detail: "ListenBrainz scrobbles with MusicBrainz attribution. Artists batch into shared royalty pools of 10.",
  },
  {
    id: "video",
    label: "Video",
    threshold: `${VIDEO_MIN_VIEWS.toLocaleString()}+ verified watches → $${VIDEO_PAYOUT_USD}`,
    detail: "Jellyfin playback in funded programs credits creators per view block.",
  },
  {
    id: "research",
    label: "Research",
    threshold: `${RESEARCH_MIN_VIEWS.toLocaleString()}+ attributed views → $${RESEARCH_PAYOUT_USD}`,
    detail: "OpenAlex / Crossref exposure. Researchers batch into citation pools of 10.",
  },
];
