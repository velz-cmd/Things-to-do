import { describe, expect, it } from "vitest";
import { buildPreviewCohortPayees } from "../../src/lib/discover/preview-cohort-payees";
import { COHORT_POOL_SIZE, MUSIC_PAYOUT_USD, OSS_PAYOUT_USD } from "../../src/lib/earn/discover-eligibility";

describe("preview-cohort-payees", () => {
  it("returns 10 tiered payees for react", () => {
    const batch = buildPreviewCohortPayees("react");
    expect(batch).toHaveLength(COHORT_POOL_SIZE);
    expect(batch[0]!.owedUsd).toBeGreaterThanOrEqual(OSS_PAYOUT_USD);
    expect(batch[batch.length - 1]!.owedUsd).toBeGreaterThan(batch[0]!.owedUsd);
  });

  it("uses music minimum payout for navidrome", () => {
    const batch = buildPreviewCohortPayees("navidrome");
    expect(batch.every((p) => p.owedUsd >= MUSIC_PAYOUT_USD)).toBe(true);
  });
});
