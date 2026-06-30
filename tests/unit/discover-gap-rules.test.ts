import { describe, expect, it } from "vitest";
import {
  capSeedGaps,
  formatProofSource,
  gapMatchesRadar,
  isMusicAuthorization,
  isResearchAuthorization,
  isSeedGap,
  isVerifiedGap,
} from "../../src/lib/discover/gap-rules";
import type { TrendingValueGap } from "../../src/lib/discover/types";

function gap(partial: Partial<TrendingValueGap> & Pick<TrendingValueGap, "id">): TrendingValueGap {
  return {
    domain: "oss",
    headline: "test",
    why: "why",
    whoBenefits: "who",
    proofSource: "proof",
    dataSource: "github",
    amountVerified: true,
    amountNeededUsd: 10,
    moneyCanMoveUsd: 10,
    peopleImpacted: 1,
    trendScore: 1,
    actions: [],
    ...partial,
  };
}

describe("gap-rules", () => {
  it("formatProofSource cites authorization id and connector", () => {
    expect(
      formatProofSource({
        connectorId: "github",
        authorizationId: "auth-abc12345",
        fallback: "x",
      }),
    ).toBe("github · authorization auth-abc");
  });

  it("formatProofSource cites github scan timestamp", () => {
    const at = "2026-06-22T12:00:00.000Z";
    expect(formatProofSource({ githubScanAt: at, fallback: "x" })).toContain("GitHub scan");
  });

  it("isVerifiedGap requires proof fields", () => {
    expect(isVerifiedGap(gap({ id: "a", proofAuthorizationId: "x" }))).toBe(true);
    expect(isVerifiedGap(gap({ id: "b", proofGithubScanAt: "t" }))).toBe(true);
    expect(isVerifiedGap(gap({ id: "c", amountVerified: false }))).toBe(false);
    expect(isVerifiedGap(gap({ id: "seed-1", dataSource: "catalog_preview" }))).toBe(false);
  });

  it("isSeedGap detects catalog preview cards", () => {
    expect(isSeedGap(gap({ id: "seed-react", dataSource: "catalog_preview", amountVerified: false }))).toBe(
      true,
    );
  });

  it("capSeedGaps limits seed cards", () => {
    const verified = gap({ id: "oss-1", proofGithubScanAt: "t" });
    const seeds = [
      gap({ id: "seed-a", dataSource: "catalog_preview", amountVerified: false }),
      gap({ id: "seed-b", dataSource: "catalog_preview", amountVerified: false }),
      gap({ id: "seed-c", dataSource: "catalog_preview", amountVerified: false }),
      gap({ id: "seed-d", dataSource: "catalog_preview", amountVerified: false }),
    ];
    const capped = capSeedGaps([...seeds, verified], 3);
    expect(capped.filter(isSeedGap)).toHaveLength(3);
    expect(capped.some((g) => g.id === "oss-1")).toBe(true);
  });

  it("detects music and research authorizations", () => {
    expect(isMusicAuthorization({ payeeKeyType: "listen_artist", connectorId: "listenbrainz" })).toBe(
      true,
    );
    expect(isResearchAuthorization({ connectorId: "openalex" })).toBe(true);
    expect(isResearchAuthorization({ connectorId: "crossref" })).toBe(true);
  });

  it("maps domains to radars", () => {
    expect(gapMatchesRadar(gap({ id: "1", domain: "research" }), "dao")).toBe(true);
    expect(gapMatchesRadar(gap({ id: "2", domain: "music" }), "oss")).toBe(false);
  });
});
