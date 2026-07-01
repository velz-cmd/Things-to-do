import { describe, expect, it } from "vitest";
import {
  classifyNeedType,
  enrichGapWithNeedType,
  filterGapsByNeedType,
  needTypeFromTemplateId,
  primaryBoardCtaLabel,
  stripCreatorClaimActions,
} from "../../src/lib/discover/need-types";
import type { TrendingValueGap } from "../../src/lib/discover/types";

function baseGap(overrides: Partial<TrendingValueGap> = {}): TrendingValueGap {
  return {
    id: "gap-1",
    domain: "oss",
    headline: "facebook/react",
    why: "Maintainer gap from GitHub scan",
    whoBenefits: "Maintainers",
    proofSource: "github",
    dataSource: "github",
    amountVerified: false,
    amountNeededUsd: 100,
    moneyCanMoveUsd: 100,
    peopleImpacted: 3,
    trendScore: 50,
    communitySlug: "react",
    templateId: "docs-bounty",
    actions: [
      { id: "fund", label: "Fund", kind: "fund", communitySlug: "react", templateId: "docs-bounty" },
      { id: "docs", label: "Docs bounty", kind: "create_program", communitySlug: "react", templateId: "docs-bounty" },
    ],
    ...overrides,
  };
}

describe("discover need types", () => {
  it("maps RFB templates to need types", () => {
    expect(needTypeFromTemplateId("docs-bounty")).toBe("docs");
    expect(needTypeFromTemplateId("security-fund")).toBe("reviewers");
    expect(needTypeFromTemplateId("user-centric-royalties")).toBe("artists");
    expect(needTypeFromTemplateId("citation-toll")).toBe("researchers");
    expect(needTypeFromTemplateId("quadratic-funding")).toBe("grants");
  });

  it("classifies music and research domains", () => {
    expect(classifyNeedType({ domain: "music" })).toBe("artists");
    expect(classifyNeedType({ domain: "research", templateId: "citation-toll" })).toBe("researchers");
    expect(classifyNeedType({ headline: "CVE-2024 advisory", domain: "oss" })).toBe("reviewers");
    expect(classifyNeedType({ headline: "i18n locale pack", domain: "oss" })).toBe("translators");
  });

  it("strips claim actions from funder-facing gap surfaces", () => {
    const actions = stripCreatorClaimActions([
      { id: "claim", label: "Claim", kind: "claim", href: "/claim" },
      { id: "fund", label: "Fund", kind: "fund", communitySlug: "navidrome" },
    ]);
    expect(actions.map((a) => a.kind)).toEqual(["fund"]);
  });

  it("enriches music gaps without claim CTAs", () => {
    const enriched = enrichGapWithNeedType(
      baseGap({
        domain: "music",
        templateId: "user-centric-royalties",
        communitySlug: "navidrome",
        actions: [
          { id: "claim", label: "Claim artist", kind: "claim", href: "/claim" },
          { id: "fund", label: "Fund pool", kind: "fund", communitySlug: "navidrome" },
        ],
      }),
    );
    expect(enriched.needType).toBe("artists");
    expect(enriched.actions.some((a) => a.kind === "claim")).toBe(false);
    expect(enriched.actions[0]?.kind).toBe("fund");
  });

  it("enriches gaps with need type, copy, and primary CTA order", () => {
    const enriched = enrichGapWithNeedType(baseGap());
    expect(enriched.needType).toBe("docs");
    expect(enriched.headline).toContain("documentation");
    expect(enriched.actions[0]?.kind).toBe("create_program");
    expect(enriched.actions[0]?.label).toBe("Launch docs bounty");
  });

  it("filters gaps by need type", () => {
    const gaps = [
      { id: "1", needType: "docs" as const },
      { id: "2", needType: "grants" as const },
    ];
    expect(filterGapsByNeedType(gaps, "docs")).toHaveLength(1);
    expect(filterGapsByNeedType(gaps, "all")).toHaveLength(2);
  });

  it("uses need-specific board CTAs", () => {
    expect(
      primaryBoardCtaLabel("docs", { boardKind: "program", templateId: "docs-bounty" }),
    ).toBe("Fund docs bounty");
    expect(
      primaryBoardCtaLabel("artists", {
        boardKind: "community",
        templateId: "user-centric-royalties",
        connectCta: "Connect Navidrome",
      }),
    ).toBe("Connect music sensor");
  });
});
