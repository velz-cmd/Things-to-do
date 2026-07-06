import { describe, expect, it } from "vitest";
import {
  buildPreviewCohortPayees,
  distributeMilestoneUsd,
} from "../../src/lib/discover/preview-cohort-payees";

describe("preview-cohort-payees", () => {
  it("distributes exactly $500 across 10 react creators", () => {
    const batch = buildPreviewCohortPayees("react", 500);
    expect(batch).toHaveLength(10);
    const total = batch.reduce((s, p) => s + p.owedUsd, 0);
    expect(total).toBeCloseTo(500, 2);
    expect(batch[0]!.label).toMatch(/—/);
    expect(batch[batch.length - 1]!.owedUsd).toBeGreaterThan(batch[0]!.owedUsd);
  });

  it("uses human names not slug tokens", () => {
    const batch = buildPreviewCohortPayees("react", 500);
    expect(batch[0]!.label).toContain("Maya Okonkwo");
    expect(batch[0]!.label).not.toContain("tutorial-author");
  });

  it("supports Mission tab batch size of 4", () => {
    const batch = buildPreviewCohortPayees("linux", 100, 4);
    expect(batch).toHaveLength(4);
    expect(batch.reduce((s, p) => s + p.owedUsd, 0)).toBeCloseTo(100, 2);
    expect(batch[0]!.label).toContain("Linus Torvalds");
  });

  it("distributes custom milestone totals", () => {
    const members = [
      { name: "A", work: "x", weight: 1 },
      { name: "B", work: "y", weight: 2 },
    ];
    const out = distributeMilestoneUsd(members, 100);
    expect(out.reduce((s, r) => s + r.owedUsd, 0)).toBeCloseTo(100, 2);
  });
});
