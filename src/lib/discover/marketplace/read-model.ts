import { createHash } from "node:crypto";
import type { FundingOpportunity, GitHubFundingActivityRecord } from "@/lib/github/types";
import type { LiveSettlementRow } from "@/lib/discover/live-settlements";
import {
  discoverNavigationAction,
  workbenchAction,
} from "@/lib/discover/marketplace/action-contract";
import { githubWorkImpactProfile } from "@/lib/discover/impact/impact-signals";
import type { MarketplaceOpportunity, OpportunityType } from "./contracts";

export type GithubEvidenceReference = {
  id: string;
  externalId: string;
  subjectRef: string;
  kind: string;
  sourceUrl: string | null;
};

const ACCEPTED_WORK_CATEGORIES = new Set([
  "code",
  "review",
  "documentation",
  "release_work",
]);

const ACCEPTED_SOURCE_KINDS = new Set([
  "pull_request",
  "review",
  "release",
]);

function opaqueSlug(source: string, id: string, title: string) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "record";
  const hash = createHash("sha256").update(`${source}:${id}`).digest("hex").slice(0, 10);
  return `${base}-${hash}`;
}

function workType(record: GitHubFundingActivityRecord): OpportunityType {
  return record.category === "documentation" ? "project_contribution" : "repository_fix";
}

function acceptedRecord(record: GitHubFundingActivityRecord) {
  return (
    ACCEPTED_WORK_CATEGORIES.has(record.category) &&
    ACCEPTED_SOURCE_KINDS.has(record.sourceKind) &&
    /^https:\/\/github\.com\//i.test(record.sourceUrl)
  );
}

export function normalizeGithubAcceptedWork(
  repositories: FundingOpportunity[],
  evidenceReferences?: GithubEvidenceReference[],
): MarketplaceOpportunity[] {
  const seen = new Set<string>();
  const evidenceBySource = new Map(
    (evidenceReferences ?? []).map((evidence) => [
      `${evidence.subjectRef.toLowerCase()}:${evidence.externalId}`,
      evidence,
    ]),
  );
  const requireCanonicalEvidence = evidenceReferences !== undefined;
  return repositories.flatMap((repository) =>
    (repository.activity?.records ?? []).flatMap((record) => {
      if (!acceptedRecord(record)) return [];
      const identity = `${repository.fullName.toLowerCase()}:${record.sourceKind}:${record.id}`;
      const evidence = evidenceBySource.get(
        `github:${repository.fullName.toLowerCase()}:${record.id}`,
      );
      if (requireCanonicalEvidence && !evidence) return [];
      if (seen.has(identity)) return [];
      seen.add(identity);
      const detailPath = `/discover?view=explore&kind=work&work=${encodeURIComponent(identity)}`;
      return [
        {
          id: `github-work:${identity}`,
          slug: opaqueSlug("github-work", identity, record.title),
          title: record.title,
          summary: `${record.actor} completed accepted ${record.category.replaceAll("_", " ")} in ${repository.fullName}.`,
          description:
            "This record comes from a persisted GitHub repository snapshot. It is valid work evidence, but it has no funding claim until a policy creates an obligation.",
          type: workType(record),
          status: "verified",
          creator: {
            type: "individual",
            name: record.actor,
            verified: true,
          },
          repository: repository.fullName,
          category: record.category,
          skills: [],
          deliverables: [record.title],
          evidenceRequirements: ["Persisted GitHub source record"],
          eligibility: [],
          provider: { preference: "open" },
          publishedAt: record.occurredAt,
          updatedAt: repository.activity?.observedAt ?? record.occurredAt,
          verificationStatus: "verified_evidence_no_funding_rule",
          riskFlags: [],
          source: { type: "github_evidence", id: identity },
          marketplaceKind: "verified_work",
          sourceUrl: record.sourceUrl,
          impactProfile: githubWorkImpactProfile({
            repositoryFullName: repository.fullName,
            adoption: repository.adoption,
            security: repository.security,
          }),
          externalFundingContext: repository.externalFundingContext,
          entityState: {
            provenance: "external_integration",
            lifecycle: "observed",
            financialReadiness: "setup_required",
            blocker: "No active funding policy covers this verified work.",
          },
          primaryAction: workbenchAction({
            id: "discover.open_evidence",
            label: "View proof",
            href: detailPath,
          }, {
            panel: "evidence",
            subjectId: identity,
            sourceUrl: record.sourceUrl,
            repository: repository.fullName,
            evidenceIds: [evidence?.id ?? identity],
          }),
          secondaryActions: [],
        } satisfies MarketplaceOpportunity,
      ];
    }),
  );
}

const MAX_RELEASES_PER_REPO = 3;

/**
 * Real GitHub Releases as their own truthful software outcome (Phase 2
 * item 2/7): "release published" - not an outcome for every commit, and
 * not the PR/issue title-keyword heuristic. A release proves only that it
 * was published, so verificationStatus stays "verified_evidence_no_funding_rule"
 * exactly like accepted-work records: real evidence, no funding claim
 * until a policy creates one.
 *
 * Role semantics (Phase 2 item 5): GitHub proves this person published
 * this release - it does not prove they are "the maintainer" of the
 * project. creator.type stays "individual"; "Release publisher" is
 * stated in the summary, never "maintainer", unless a separate
 * authoritative source proves that role.
 */
export function normalizeGithubReleases(
  repositories: FundingOpportunity[],
): MarketplaceOpportunity[] {
  return repositories.flatMap((repository) => {
    const releases = (repository.releases ?? []).slice(0, MAX_RELEASES_PER_REPO);
    return releases.flatMap((release) => {
      if (!release.publishedAt || !release.author) return [];
      const identity = `${repository.fullName.toLowerCase()}:release:${release.id}`;
      const title = release.name?.trim() || `Release ${release.tagName}`;
      const detailPath = `/discover?view=explore&kind=work&work=${encodeURIComponent(identity)}`;
      return [
        {
          id: `github-release:${identity}`,
          slug: opaqueSlug("github-release", identity, title),
          title,
          summary: `${release.author} published ${release.tagName}${release.prerelease ? " (prerelease)" : ""} for ${repository.fullName}.`,
          description:
            "This record comes from GitHub's Releases API. It proves a release was published - it does not by itself prove adoption, security remediation, or economic value.",
          type: "project_contribution",
          status: "verified",
          creator: {
            type: "individual",
            name: release.author,
            verified: true,
          },
          repository: repository.fullName,
          category: "release_work",
          skills: [],
          deliverables: [title],
          evidenceRequirements: ["Persisted GitHub release record"],
          eligibility: [],
          provider: { preference: "open" },
          publishedAt: release.publishedAt,
          updatedAt: release.publishedAt,
          verificationStatus: "verified_evidence_no_funding_rule",
          riskFlags: release.prerelease ? ["prerelease"] : [],
          source: { type: "github_evidence", id: identity },
          marketplaceKind: "verified_work",
          sourceUrl: release.htmlUrl,
          impactProfile: githubWorkImpactProfile({
            repositoryFullName: repository.fullName,
            adoption: repository.adoption,
            security: repository.security,
          }),
          externalFundingContext: repository.externalFundingContext,
          entityState: {
            provenance: "external_integration",
            lifecycle: "observed",
            financialReadiness: "setup_required",
            blocker: "No active funding policy covers this verified work.",
          },
          primaryAction: workbenchAction({
            id: "discover.open_evidence",
            label: "View proof",
            href: detailPath,
          }, {
            panel: "evidence",
            subjectId: identity,
            sourceUrl: release.htmlUrl,
            repository: repository.fullName,
            evidenceIds: [identity],
          }),
          secondaryActions: [],
        } satisfies MarketplaceOpportunity,
      ];
    });
  });
}

export function normalizeConfirmedOutcomes(
  settlements: LiveSettlementRow[],
): MarketplaceOpportunity[] {
  return settlements.flatMap((row) => {
    if (row.status !== "confirmed" || !row.receiptHref || !row.explorerUrl) return [];
    const communityName = row.communityName ?? row.communitySlug;
    return [
      {
        id: `outcome:${row.id}`,
        slug: opaqueSlug("confirmed-outcome", row.id, row.title),
        title: row.title,
        summary: row.subline ?? "Confirmed Arc settlement with an issued receipt.",
        description:
          "This outcome is backed by a confirmed chain transaction and a persisted RESOLVE receipt.",
        type: "campaign",
        status: "confirmed",
        creator: {
          type: "community",
          name: communityName ?? "RESOLVE",
          verified: true,
        },
        community: communityName
          ? { id: row.communitySlug, name: communityName }
          : undefined,
        skills: [],
        deliverables: ["Confirmed settlement", "Public receipt"],
        evidenceRequirements: ["Confirmed Arc transaction", "RESOLVE receipt"],
        eligibility: [],
        reward: { amountUsd: row.amountUsd, token: "USDC", network: "Arc Testnet" },
        funding: {
          fundedAmountUsd: row.amountUsd,
          status: "funded",
          source: "Confirmed Arc settlement",
          amountState: "confirmed",
        },
        provider: { preference: "selected" },
        publishedAt: row.at,
        updatedAt: row.at,
        verificationStatus: "settlement_confirmed",
        riskFlags: [],
        source: { type: "confirmed_receipt", id: row.id },
        marketplaceKind: "outcome",
        sourceUrl: row.explorerUrl,
        entityState: {
          provenance: "canonical_record",
          lifecycle: "confirmed",
          financialReadiness: "confirmed",
        },
        primaryAction: workbenchAction({
          id: "receipt.open",
          label: "View receipt",
          href: row.receiptHref,
        }, {
          panel: "receipt",
          subjectId: row.id,
          receiptUrl: row.receiptHref,
          explorerUrl: row.explorerUrl ?? undefined,
        }),
        secondaryActions: [
          discoverNavigationAction({
            id: "receipt.open_arcscan",
            label: "View Arc transaction",
            href: row.explorerUrl,
          }, { target: "external", secondary: true }),
        ],
      } satisfies MarketplaceOpportunity,
    ];
  });
}
