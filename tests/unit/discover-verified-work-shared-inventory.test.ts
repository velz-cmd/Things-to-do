import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Phase 1F/1J: Verified Work's software/research/media sources must be
 * structurally incapable of depending on which viewer is looking - not
 * just "happen to" today. Each loader's own signature takes zero
 * arguments, so there is no parameter through which a userId/viewerId
 * could ever be threaded in, by accident or by a future edit. This is a
 * static, source-level guarantee rather than a runtime behavior check,
 * matching the existing fixture-leakage boundary test's pattern.
 */
describe("Verified Work shared-source signatures never accept a viewer parameter", () => {
  it("loadResearchSignals() takes no arguments", () => {
    const source = readFileSync(
      "src/lib/discover/marketplace/research-signal-source.ts",
      "utf8",
    );
    expect(source).toMatch(/export async function loadResearchSignals\(\s*\)/);
  });

  it("loadMediaSignals() takes no arguments", () => {
    const source = readFileSync(
      "src/lib/discover/marketplace/media-signal-source.ts",
      "utf8",
    );
    expect(source).toMatch(/export async function loadMediaSignals\(\s*\)/);
  });

  it("loadVerifiedGithubWork() (the shared GitHub accepted-work source) takes no arguments", () => {
    const source = readFileSync("src/lib/discover/marketplace/query.ts", "utf8");
    expect(source).toMatch(/async function loadVerifiedGithubWork\(\s*\)/);
  });
});
