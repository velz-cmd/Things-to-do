import { describe, expect, it } from "vitest";
import { buildBubbleOperatorSurface } from "../../src/lib/discover/bubble-operator-surface";
import { bubbleOperatorActions } from "../../src/lib/discover/graph-node-actions";
import type { DiscoverGraphEdge, DiscoverGraphNode } from "../../src/lib/discover/radar";

function node(partial: Partial<DiscoverGraphNode> & Pick<DiscoverGraphNode, "id" | "label" | "type">): DiscoverGraphNode {
  return { weight: 1, ...partial };
}

describe("bubble operator surface", () => {
  it("builds five console sections from graph context", () => {
    const n = node({
      id: "community:react",
      label: "React",
      type: "ecosystem",
      communitySlug: "react",
      templateId: "docs-bounty",
      whyItMatters: "Fund maintainers",
      moneyGapUsd: 120,
      amountVerified: false,
      synthetic: true,
    });
    const surface = buildBubbleOperatorSurface({
      node: n,
      nodes: [n],
      edges: [],
      metrics: null,
    });
    expect(surface.sections.map((s) => s.id)).toEqual([
      "needs",
      "programs",
      "money",
      "people",
      "open_work",
    ]);
    expect(surface.observatoryHref).toBe("/communities/react#observatory");
  });
});

describe("bubble operator actions", () => {
  it("returns concrete fund and settlement actions for ecosystems", () => {
    const react = node({
      id: "community:react",
      label: "React",
      type: "ecosystem",
      communitySlug: "react",
      templateId: "docs-bounty",
      moneyGapUsd: 50,
    });
    const edges: DiscoverGraphEdge[] = [
      { id: "g", from: react.id, to: "pool", kind: "funding_gap", weight: 50, evidence: "gap" },
    ];
    const labels = bubbleOperatorActions(react, edges).map((a) => a.label);
    expect(labels).toEqual(
      expect.arrayContaining(["Fund this payout", "View rules", "Settle queue"]),
    );
    expect(labels.length).toBeLessThanOrEqual(4);
  });
});
