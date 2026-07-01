import { describe, expect, it } from "vitest";
import {
  bundleMeta,
  daoCardActions,
  daoToolbar,
  emptyBundle,
  enrichOssCard,
  musicCardActions,
  musicToolbar,
  ossCardActions,
  ossToolbar,
} from "../../src/lib/discover/domain-radar-actions";
import type { TrendingValueGap } from "../../src/lib/discover/types";

describe("domain radar actions", () => {
  it("oss card actions include maintainer graph, fund chain, and sensor panel", () => {
    const actions = ossCardActions({
      entityPath: "/e/repo/facebook/react",
      communitySlug: "react",
      programId: "prog-1",
      fundingGapUsd: 120,
    });
    const labels = actions.map((a) => a.label);
    expect(labels).toContain("Maintainer graph");
    expect(labels).toContain("Fund maintainers");
    expect(labels).toContain("Docs bounty");
    expect(labels).toContain("Security fund");
    expect(labels).toContain("GitHub sensor");

    const graph = actions.find((a) => a.id === "graph");
    expect(graph?.entityPath).toBe("/e/repo/facebook/react#people");

    const sensor = actions.find((a) => a.id === "sensor");
    expect(sensor?.href).toBe("/communities/react#health");
    expect(sensor?.kind).toBe("connect_sensor");

    const fund = actions.find((a) => a.id === "fund");
    expect(fund?.templateId).toBe("docs-bounty");
    expect(fund?.amountUsd).toBe(120);
  });

  it("music card actions wire royalty pool and listen proof", () => {
    const actions = musicCardActions({
      entityPath: "/e/artist/mbid-abc",
      communitySlug: "navidrome",
      programId: "prog-m",
      amountUsd: 42,
      proofHref: "/receipt/auth-1",
    });
    expect(actions.find((a) => a.kind === "claim")).toBeUndefined();

    const proof = actions.find((a) => a.id === "proof");
    expect(proof?.entityPath).toBe("/e/artist/mbid-abc#timeline");

    const royalty = actions.find((a) => a.id === "royalty");
    expect(royalty?.templateId).toBe("user-centric-royalties");
  });

  it("dao card actions fund grant pool and treasury without import members", () => {
    const actions = daoCardActions({
      programId: "qf-1",
      communitySlug: "react",
      fundingGapUsd: 200,
      templateId: "quadratic-funding",
    });
    const labels = actions.map((a) => a.label);
    expect(labels).toContain("Fund grant pool");
    expect(labels).toContain("Contributor payroll");
    expect(labels).toContain("Connect treasury");
    expect(labels).not.toContain("Import members");

    const treasury = actions.find((a) => a.id === "treasury");
    expect(treasury?.href).toBe("/communities/react#treasury");
  });

  it("toolbars cap at five distinct actions per radar", () => {
    for (const toolbar of [
      ossToolbar({ communitySlug: "react", entityPath: "/e/repo/a/b" }),
      musicToolbar({ communitySlug: "navidrome", entityPath: "/e/artist/x" }),
      daoToolbar({ communitySlug: "react", programId: "p1", fundingGapUsd: 50 }),
    ]) {
      expect(toolbar.length).toBeLessThanOrEqual(5);
      expect(toolbar.length).toBeGreaterThan(0);
    }
  });

  it("emptyBundle provides toolbar and empty state for each vertical", () => {
    for (const id of ["oss", "music", "dao"] as const) {
      const bundle = emptyBundle(id);
      expect(bundle.id).toBe(id);
      expect(bundle.toolbar.length).toBeGreaterThan(0);
      expect(bundle.emptyState.actionHref).toBeTruthy();
      expect(bundleMeta(id).title).toBeTruthy();
    }
  });

  it("enrichOssCard attaches domain actions to trending cards", () => {
    const card: TrendingValueGap = {
      id: "t-1",
      domain: "oss",
      headline: "foo/bar",
      why: "why",
      whoBenefits: "maintainers",
      proofSource: "github",
      dataSource: "github",
      amountVerified: true,
      amountNeededUsd: 80,
      moneyCanMoveUsd: 80,
      peopleImpacted: 3,
      trendScore: 80,
      entityPath: "/e/repo/foo/bar",
      communitySlug: "react",
      actions: [],
    };
    const enriched = enrichOssCard(card);
    expect(enriched.actions.length).toBeGreaterThanOrEqual(5);
  });
});
