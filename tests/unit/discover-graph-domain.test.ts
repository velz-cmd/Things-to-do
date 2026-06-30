import { describe, expect, it } from "vitest";
import {
  filterGraphByDomain,
  graphDomainForNode,
  hasFundingGapEdge,
  nodeMatchesDomainFilter,
} from "../../src/lib/discover/graph-domain";
import { bubblePopoverActions } from "../../src/lib/discover/graph-node-actions";
import type { DiscoverGraphEdge, DiscoverGraphNode } from "../../src/lib/discover/radar";

function node(partial: Partial<DiscoverGraphNode> & Pick<DiscoverGraphNode, "id" | "label" | "type">): DiscoverGraphNode {
  return { weight: 1, ...partial };
}

describe("graph domain filters", () => {
  it("maps node types to oss/music/research domains", () => {
    expect(graphDomainForNode(node({ id: "1", label: "r", type: "repository", graphDomain: "oss" }))).toBe("oss");
    expect(graphDomainForNode(node({ id: "2", label: "a", type: "creator", graphDomain: "music" }))).toBe("music");
    expect(graphDomainForNode(node({ id: "3", label: "p", type: "person", dataSource: "github" }))).toBe("oss");
  });

  it("filters graph nodes by domain chip", () => {
    const nodes = [
      node({ id: "a", label: "repo", type: "repository", graphDomain: "oss" }),
      node({ id: "b", label: "artist", type: "creator", graphDomain: "music" }),
    ];
    const edges: DiscoverGraphEdge[] = [
      { id: "e1", from: "a", to: "b", kind: "observed", weight: 1, evidence: "x" },
    ];
    const filtered = filterGraphByDomain(nodes, edges, "music");
    expect(filtered.nodes).toHaveLength(1);
    expect(filtered.nodes[0].id).toBe("b");
    expect(filtered.edges).toHaveLength(0);
  });

  it("detects funding gap edges", () => {
    const edges: DiscoverGraphEdge[] = [
      { id: "g", from: "repo", to: "pool", kind: "funding_gap", weight: 100, evidence: "gap" },
    ];
    expect(hasFundingGapEdge("repo", edges)).toBe(true);
    expect(hasFundingGapEdge("other", edges)).toBe(false);
  });

  it("matches all when filter is all", () => {
    const n = node({ id: "x", label: "x", type: "community" });
    expect(nodeMatchesDomainFilter(n, "all")).toBe(true);
  });
});

describe("bubble popover actions", () => {
  it("returns Open, Fund for gap edge, Install for community", () => {
    const repo = node({
      id: "repo:fb/react",
      label: "react",
      type: "repository",
      entityPath: "/e/repo/fb/react",
      moneyGapUsd: 50,
      communitySlug: "react",
    });
    const edges: DiscoverGraphEdge[] = [
      { id: "g", from: repo.id, to: "pool", kind: "funding_gap", weight: 50, evidence: "gap" },
    ];
    const repoActions = bubblePopoverActions(repo, edges);
    expect(repoActions.map((a) => a.label)).toEqual(expect.arrayContaining(["Open", "Fund gap"]));

    const comm = node({
      id: "community:react",
      label: "React",
      type: "community",
      communitySlug: "react",
      entityPath: "/communities/react",
    });
    const commActions = bubblePopoverActions(comm, []);
    expect(commActions.map((a) => a.label)).toEqual(expect.arrayContaining(["Open", "Install"]));
  });
});
