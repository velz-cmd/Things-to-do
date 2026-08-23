import "server-only";

import type { FundingOpportunity } from "@/lib/github/types";

/**
 * Phase 2 item 4: real dependency relationships, not only aggregate
 * counts. GitHubDependency (adapter.ts's fetchPackageDependencies) already
 * reads a repository's actual package.json manifest - a genuine edge
 * (this repo requires this package at this version range), bounded to 80
 * entries at the source, sorted deterministically. This module only
 * projects that already-fetched, already-persisted data into a canonical
 * edge shape; it does not call any new endpoint or fabricate a
 * relationship the manifest doesn't state.
 *
 * If FundingOpportunity.observedAt is absent (a snapshot persisted before
 * this field existed), edges are not projected at all - never with a
 * fabricated timestamp standing in for a real one.
 */
export type CanonicalDependencyEdge = {
  fromRepository: string;
  toPackage: string;
  requirement: string;
  kind: "runtime" | "peer" | "optional";
  source: string;
  sourceUrl: string;
  observedAt: string;
};

export function toCanonicalDependencyEdges(
  opportunity: FundingOpportunity,
): CanonicalDependencyEdge[] {
  if (!opportunity.observedAt) return [];
  const observedAt = opportunity.observedAt;
  return (opportunity.dependencies ?? []).map((dependency) => ({
    fromRepository: opportunity.fullName,
    toPackage: dependency.name,
    requirement: dependency.requirement,
    kind: dependency.kind,
    source: `package manifest (${dependency.manifestPath})`,
    sourceUrl: dependency.sourceUrl,
    observedAt,
  }));
}
