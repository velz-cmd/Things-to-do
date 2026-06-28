import { describe, expect, it } from "vitest";
import {
  betweennessCentrality,
  degreeCentralityScores,
  fundingEntropy,
  pageRankScores,
} from "@/lib/graph/metrics";

describe("graph metrics", () => {
  const triangle = ["a", "b", "c"];
  const triangleEdges = [
    { from: "a", to: "b", weight: 1 },
    { from: "b", to: "c", weight: 1 },
    { from: "a", to: "c", weight: 1 },
  ];

  it("computes degree centrality", () => {
    const scores = degreeCentralityScores(triangle, triangleEdges);
    expect(scores.get("a")).toBe(1);
    expect(scores.get("b")).toBe(1);
    expect(scores.get("c")).toBe(1);
  });

  it("computes page rank with damping", () => {
    const pr = pageRankScores(triangle, triangleEdges);
    const sum = [...pr.values()].reduce((s, v) => s + v, 0);
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThan(1.01);
  });

  it("computes betweenness on a path graph", () => {
    const nodes = ["a", "b", "c", "d"];
    const edges = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "d" },
    ];
    const bc = betweennessCentrality(nodes, edges);
    expect(bc.get("b") ?? 0).toBeGreaterThan(bc.get("a") ?? 0);
    expect(bc.get("c") ?? 0).toBeGreaterThan(bc.get("d") ?? 0);
  });

  it("computes Shannon entropy on funding shares", () => {
    const even = fundingEntropy([50, 50]);
    expect(even.entropy).toBeCloseTo(1, 1);
    const skewed = fundingEntropy([90, 5, 5]);
    expect(skewed.concentrationPct).toBeGreaterThan(80);
    expect(skewed.entropy).toBeLessThan(even.entropy);
  });

  it("returns honest entropy evidence when empty", () => {
    const empty = fundingEntropy([]);
    expect(empty.entropy).toBe(0);
    expect(empty.evidence).toMatch(/No funding distribution/);
  });
});
