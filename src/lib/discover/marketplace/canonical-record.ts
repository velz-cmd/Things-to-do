import "server-only";

import type {
  MarketplaceOpportunity,
  DiscoverPool,
} from "@/lib/discover/marketplace/contracts";
import type { ImpactSignal } from "@/lib/discover/impact/impact-signals";
import type { EconomicMatch } from "@/lib/discover/impact/economic-matching";
import type { PersistedAgentResult } from "@/lib/agent/result-by-subject";

/**
 * Canonical shared-market record contract (Phase 1A).
 *
 * This is a normalized VIEW over MarketplaceOpportunity/DiscoverPool, not a
 * replacement for either - Discover's existing types already carry every
 * field this needs; a from-scratch rewrite would only add churn without
 * changing what's actually stored or rendered. What this contract adds is
 * a single, explicit shape that every domain (software, research, media,
 * community, request, pool, agent, economic event) can be projected into,
 * so a caller that wants "the canonical record" never has to special-case
 * which connector produced it.
 *
 * Six sections, matching the product spec exactly:
 * identity, provenance, attribution, impact, economicState, presentation.
 * Presentation is display-only and must never be read as economic truth -
 * economicState is the only section funding logic may trust.
 */

export type CanonicalMarketDomain =
  | "software"
  | "research"
  | "media"
  | "community"
  | "request"
  | "pool"
  | "agent"
  | "economic_event";

export type CanonicalIdentity = {
  /** Stable across re-fetches: `${source.type}:${source.id}` today. */
  canonicalId: string;
  domain: CanonicalMarketDomain;
  entityKind: MarketplaceOpportunity["marketplaceKind"] | "pool";
  source: string;
  sourceRecordId: string;
  /** The real-world subject this record is about, when distinct from the record itself (e.g. a repository, a DOI, a recording). */
  canonicalSubject?: string;
};

export type CanonicalProvenance = {
  sourceUrl?: string;
  observedAt: string;
  lastObservedAt: string;
  refreshedAt?: string;
  verificationStatus: string;
  /** What this record's own evidence actually establishes. */
  provesClaim: string;
  /** What it explicitly does not establish - required, not optional, so no record can be silent about its own limits. */
  doesNotProveClaim: string;
};

export type CanonicalAttribution = {
  actorName: string;
  actorType: string;
  attributionSource: string;
  verified: boolean;
  /**
   * Contributor identity and payout identity are different concepts -
   * knowing who did the work is not the same as knowing where to pay
   * them. Always false at this layer: a canonical record is never itself
   * a payout destination.
   */
  payoutIdentitySeparate: true;
};

export type CanonicalImpactSignal = ImpactSignal & {
  /** Re-exported for convenience - every ImpactSignal already carries this. */
  classification: ImpactSignal["classification"];
};

export type CanonicalEconomicState = {
  demand: boolean;
  fundingMatch?: string;
  obligationPurpose?: string;
  priorCoverageCount?: number;
  payoutReady: boolean;
  authorizationState?: string;
  settlementState?: string;
};

export type CanonicalPresentation = {
  title: string;
  context: string;
  primaryActionId?: string;
};

export type CanonicalMarketRecord = {
  identity: CanonicalIdentity;
  provenance: CanonicalProvenance;
  attribution: CanonicalAttribution;
  impact: CanonicalImpactSignal[];
  economicState: CanonicalEconomicState;
  presentation: CanonicalPresentation;
};

function domainForOpportunity(item: MarketplaceOpportunity): CanonicalMarketDomain {
  switch (item.source.type) {
    case "github_evidence":
    case "repository_snapshot":
      return "software";
    case "research_work":
      return "research";
    case "listenbrainz_listen":
      return "media";
    case "open_collective_contribution":
      return "community";
    case "resolve_request":
      return "request";
    case "community_program":
      return item.marketplaceKind === "pool" ? "pool" : "community";
    case "confirmed_receipt":
      return "economic_event";
    default:
      return "community";
  }
}

/** Canonical record for one MarketplaceOpportunity - software/research/media/community/request outcomes. */
export function toCanonicalMarketRecord(
  item: MarketplaceOpportunity,
): CanonicalMarketRecord {
  const domain = domainForOpportunity(item);
  const impact: CanonicalImpactSignal[] =
    item.impactProfile?.measurable === true ? item.impactProfile.signals : [];

  return {
    identity: {
      canonicalId: `${item.source.type}:${item.source.id}`,
      domain,
      entityKind: item.marketplaceKind ?? "opportunity",
      source: item.source.type,
      sourceRecordId: item.source.id,
      canonicalSubject: item.repository ?? item.projectId,
    },
    provenance: {
      sourceUrl: item.sourceUrl,
      observedAt: item.publishedAt,
      lastObservedAt: item.updatedAt,
      verificationStatus: item.verificationStatus,
      provesClaim: item.description,
      doesNotProveClaim:
        item.impactProfile?.measurable === false
          ? item.impactProfile.reason
          : "This record does not by itself establish funding, ownership, or economic value beyond what its impact signals state.",
    },
    attribution: {
      actorName: item.creator.name,
      actorType: item.creator.type,
      attributionSource: item.source.type,
      verified: item.creator.verified,
      payoutIdentitySeparate: true,
    },
    impact,
    economicState: {
      demand: Boolean(item.economicMatch?.eligible.length),
      fundingMatch: item.economicMatch?.recommended ?? undefined,
      priorCoverageCount: item.economicMatch?.coverage.length,
      payoutReady: item.entityState?.financialReadiness === "ready",
      authorizationState: item.entityState?.financialReadiness,
      settlementState: item.funding?.amountState,
    },
    presentation: {
      title: item.title,
      context: item.summary,
      primaryActionId: item.primaryAction?.id,
    },
  };
}

/** Canonical record for one DiscoverPool - the capital-market domain. */
export function toCanonicalPoolRecord(pool: DiscoverPool): CanonicalMarketRecord {
  return {
    identity: {
      canonicalId: `pool:${pool.id}`,
      domain: "pool",
      entityKind: "pool",
      source: "community_program",
      sourceRecordId: pool.id,
      canonicalSubject: pool.communitySlug,
    },
    provenance: {
      observedAt: pool.observedAt,
      lastObservedAt: pool.updatedAt,
      verificationStatus: pool.publicationState,
      provesClaim: pool.purpose ?? "A registered community funding Pool exists.",
      doesNotProveClaim:
        "This record does not establish that the Pool is currently market-listed or fundable - see economicState.",
    },
    attribution: {
      actorName: pool.owner,
      actorType: "operator",
      attributionSource: "community_program",
      verified: true,
      payoutIdentitySeparate: true,
    },
    impact: [],
    economicState: {
      demand: (pool.targetUsd ?? 0) > (pool.balanceUsd ?? 0),
      payoutReady: pool.treasuryReadiness === "ready",
      authorizationState: pool.treasuryReadiness,
      settlementState: pool.balanceState,
    },
    presentation: {
      title: pool.name,
      context: pool.purpose ?? pool.name,
      primaryActionId: pool.primaryAction?.id,
    },
  };
}

/**
 * Canonical record for one persisted Agent result - the agent domain.
 * Deliberately its own builder rather than a case in domainForOpportunity:
 * an agent result is not itself a MarketplaceOpportunity, it is a result
 * attached to one (see MarketplaceOpportunity.agentResult and
 * src/lib/agent/result-by-subject.ts). subjectType/subjectId identify the
 * outcome this result is contextually attached to - the canonicalSubject.
 */
export function toCanonicalAgentResultRecord(input: {
  subjectType: string;
  subjectId: string;
  result: PersistedAgentResult;
}): CanonicalMarketRecord {
  const { subjectType, subjectId, result } = input;
  return {
    identity: {
      canonicalId: `agent_result:${result.serviceId}:${subjectType}:${subjectId}`,
      domain: "agent",
      entityKind: "opportunity",
      source: "agent_service",
      sourceRecordId: result.serviceId,
      canonicalSubject: `${subjectType}:${subjectId}`,
    },
    provenance: {
      observedAt: result.occurredAt,
      lastObservedAt: result.occurredAt,
      verificationStatus: "confirmed",
      provesClaim: "A paid Agent service run produced this structured result for the named subject.",
      doesNotProveClaim:
        "This result does not by itself change funding state - the economic matcher must re-run to know whether it does.",
    },
    attribution: {
      actorName: result.serviceId,
      actorType: "agent_service",
      attributionSource: "agent_service",
      verified: true,
      payoutIdentitySeparate: true,
    },
    impact: [],
    economicState: {
      demand: false,
      payoutReady: true,
      settlementState: "confirmed",
    },
    presentation: {
      title: `${result.serviceId} result`,
      context: result.summary ?? "No summary was returned.",
    },
  };
}

/**
 * Phase 1G corrective: canonical search-document projection.
 *
 * This is the searchable-index FOUNDATION only - a deterministic, pure
 * projection of the fields a search index would key on. It is not Phase
 * 12's search UI/engine; nothing here queries anything or ranks results.
 * It exists so a future search implementation has one normalized shape to
 * index, instead of every caller re-deciding which CanonicalMarketRecord
 * fields count as "searchable" for its domain.
 *
 * canonicalSubject already covers repository/package/project identity for
 * software; for domains where the record's own subject is its source
 * record ID (research: DOI/arXiv id embedded in source.id; media: a
 * recording identity), sourceRecordId is included so that identity is
 * still searchable even when canonicalSubject is absent - never invented,
 * only what the record already carries.
 */
export type CanonicalSearchDocument = {
  canonicalId: string;
  domain: CanonicalMarketDomain;
  title: string;
  canonicalSubject?: string;
  actorName: string;
  /** Deduplicated, trimmed terms a search index should key this record on. */
  searchableTerms: string[];
};

export function toCanonicalSearchDocument(
  record: CanonicalMarketRecord,
): CanonicalSearchDocument {
  const candidates = [
    record.presentation.title,
    record.identity.canonicalSubject,
    record.identity.sourceRecordId,
    record.attribution.actorName,
  ];
  const searchableTerms = [
    ...new Set(
      candidates
        .map((term) => term?.trim())
        .filter((term): term is string => Boolean(term)),
    ),
  ];

  return {
    canonicalId: record.identity.canonicalId,
    domain: record.identity.domain,
    title: record.presentation.title,
    canonicalSubject: record.identity.canonicalSubject,
    actorName: record.attribution.actorName,
    searchableTerms,
  };
}

export type { EconomicMatch };
