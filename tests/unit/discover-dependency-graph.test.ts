import { describe, expect, it } from "vitest";
import { toCanonicalDependencyEdges } from "@/lib/discover/marketplace/dependency-graph";
import type { FundingOpportunity } from "@/lib/github/types";

function opportunity(overrides: Partial<FundingOpportunity> = {}): FundingOpportunity {
  return {
    id: "opp-acme-widgets",
    owner: "acme",
    repo: "widgets",
    fullName: "acme/widgets",
    observedAt: "2026-08-01T00:00:00.000Z",
    stars: 10,
    forks: 2,
    health: {
      score: 80,
      grade: "B",
      signals: [],
      maintainerCount: 1,
      fundingGapUsd: 0,
      headline: "Healthy",
    },
    unfundedMaintainers: 1,
    highImpactPrs: 0,
    headline: "headline",
    priority: "medium",
    live: true,
    ...overrides,
  };
}

describe("toCanonicalDependencyEdges", () => {
  it("produces no edges when no dependencies were observed", () => {
    expect(toCanonicalDependencyEdges(opportunity())).toEqual([]);
  });

  it("projects a real manifest-sourced edge with full provenance", () => {
    const edges = toCanonicalDependencyEdges(
      opportunity({
        dependencies: [
          {
            name: "left-pad",
            requirement: "^1.3.0",
            kind: "runtime",
            manifestPath: "package.json",
            sourceUrl: "https://github.com/acme/widgets/blob/main/package.json",
          },
        ],
      }),
    );
    expect(edges).toEqual([
      {
        fromRepository: "acme/widgets",
        toPackage: "left-pad",
        requirement: "^1.3.0",
        kind: "runtime",
        source: "package manifest (package.json)",
        sourceUrl: "https://github.com/acme/widgets/blob/main/package.json",
        observedAt: "2026-08-01T00:00:00.000Z",
      },
    ]);
  });

  it("never fabricates edges when the snapshot has no real observedAt timestamp", () => {
    const edges = toCanonicalDependencyEdges(
      opportunity({
        observedAt: undefined,
        dependencies: [
          {
            name: "left-pad",
            requirement: "^1.3.0",
            kind: "runtime",
            manifestPath: "package.json",
            sourceUrl: "https://github.com/acme/widgets/blob/main/package.json",
          },
        ],
      }),
    );
    expect(edges).toEqual([]);
  });

  it("preserves peer/optional dependency kind distinctly from runtime", () => {
    const edges = toCanonicalDependencyEdges(
      opportunity({
        dependencies: [
          { name: "a", requirement: "^1.0.0", kind: "runtime", manifestPath: "package.json", sourceUrl: "https://x/a" },
          { name: "b", requirement: "^2.0.0", kind: "peer", manifestPath: "package.json", sourceUrl: "https://x/b" },
          { name: "c", requirement: "^3.0.0", kind: "optional", manifestPath: "package.json", sourceUrl: "https://x/c" },
        ],
      }),
    );
    expect(edges.map((e) => e.kind)).toEqual(["runtime", "peer", "optional"]);
  });
});
