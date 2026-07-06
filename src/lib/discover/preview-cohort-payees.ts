import {
  COHORT_POOL_SIZE,
  MUSIC_PAYOUT_USD,
  OSS_PAYOUT_USD,
  RESEARCH_PAYOUT_USD,
} from "../earn/discover-eligibility";

const PREVIEW_PAYEE_LABELS: Record<string, string[]> = {
  react: [
    "docs-maintainer",
    "tutorial-author",
    "api-writer",
    "changelog-editor",
    "examples-contrib",
    "i18n-volunteer",
    "typo-fixer",
    "reviewer-a",
    "reviewer-b",
    "onboarding-docs",
  ],
  linux: [
    "kernel-maintainer",
    "security-reviewer",
    "driver-author",
    "docs-maintainer",
    "backport-fixer",
    "cve-responder",
    "build-maintainer",
    "arch-tester",
    "subsystem-lead",
    "release-helper",
  ],
  jellyfin: [
    "plugin-author",
    "theme-designer",
    "subtitle-contrib",
    "server-admin",
    "metadata-editor",
    "codec-tester",
    "docs-writer",
    "translator",
    "community-mod",
    "stream-optimizer",
  ],
  navidrome: [
    "indie-artist-a",
    "session-musician",
    "composer-b",
    "label-artist",
    "remix-artist",
    "cover-artist",
    "playlist-curator",
    "live-recording",
    "podcast-host",
    "sound-engineer",
  ],
  "independent-music": [
    "bedroom-producer",
    "vocalist",
    "beatmaker",
    "mix-engineer",
    "mastering-artist",
    "collab-vocal",
    "session-guitar",
    "lyricist",
    "sample-pack",
    "live-set",
  ],
  "open-research": [
    "lead-author",
    "co-author-1",
    "co-author-2",
    "dataset-curator",
    "reviewer-open",
    "citation-target",
    "methods-contrib",
    "fig-maker",
    "editor-volunteer",
    "replication-lab",
  ],
};

/** Tiered batch payouts for preview rows — min block payout up to ~10× for top eligibility. */
function tieredBatchAmounts(
  batchSize: number,
  minUsd: number,
  maxUsd: number,
  targetTotalUsd: number,
): number[] {
  if (batchSize <= 1) return [Math.min(maxUsd, targetTotalUsd)];
  const step = (maxUsd - minUsd) / (batchSize - 1);
  let amounts = Array.from({ length: batchSize }, (_, i) =>
    Math.round(minUsd + step * i),
  );
  const sum = amounts.reduce((s, a) => s + a, 0);
  if (sum > targetTotalUsd) {
    const scale = targetTotalUsd / sum;
    amounts = amounts.map((a) => Math.max(minUsd, Math.round(a * scale)));
  }
  return amounts;
}

function minPayoutForSlug(slug: string): number {
  if (slug === "open-research") return RESEARCH_PAYOUT_USD;
  if (slug === "jellyfin") return 10;
  if (slug === "navidrome" || slug === "independent-music") return MUSIC_PAYOUT_USD;
  return OSS_PAYOUT_USD;
}

/** Next milestone batch preview — who gets paid when the pool hits $500 (or current ceiling). */
export function buildPreviewCohortPayees(
  slug: string,
  milestoneUsd = 500,
  batchSize = COHORT_POOL_SIZE,
): Array<{ label: string; owedUsd: number }> {
  const labels = PREVIEW_PAYEE_LABELS[slug] ?? PREVIEW_PAYEE_LABELS.react!;
  const minUsd = minPayoutForSlug(slug);
  const maxUsd = Math.min(100, Math.max(minUsd * 10, minUsd));
  const targetTotal = Math.min(milestoneUsd, Math.max(minUsd * batchSize, minUsd * 4));
  const amounts = tieredBatchAmounts(batchSize, minUsd, maxUsd, targetTotal);

  return labels.slice(0, batchSize).map((label, i) => ({
    label: label.replace(/-/g, " "),
    owedUsd: amounts[i] ?? minUsd,
  }));
}
