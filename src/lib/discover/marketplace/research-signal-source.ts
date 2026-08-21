import { searchCrossref, pingCrossref } from "@/lib/integrations/crossref";
import { discoverNavigationAction } from "@/lib/discover/marketplace/action-contract";
import type { MarketplaceOpportunity } from "@/lib/discover/marketplace/contracts";
import type { ImpactProfile } from "@/lib/discover/impact/impact-signals";

/**
 * Real-money-adjacent research-domain outcomes sourced from Crossref, the
 * public scholarly metadata registry. Each item is a published work with a
 * real DOI and a real citation count - not an inference, not a funding
 * claim. Citation counts are surfaced as impact evidence (scope: artifact),
 * never as money, per src/lib/discover/impact/impact-signals.ts.
 *
 * What this proves: a specific published work exists, is citable, and has
 * been cited N times per Crossref's public ledger.
 * What this does not prove: that RESOLVE, or anyone, has funded this work.
 * No `funding` field is set on these items for that reason.
 */
const RESEARCH_QUERY = "open source software sustainability funding";
const MAX_WORKS = 8;

export async function loadResearchSignals(): Promise<MarketplaceOpportunity[]> {
  let works;
  try {
    works = await searchCrossref(RESEARCH_QUERY, MAX_WORKS);
  } catch {
    return [];
  }
  if (!works.length) return [];

  return works
    .filter((w) => w.doi)
    .map((w): MarketplaceOpportunity => {
      const observedAt = new Date().toISOString();
      const impactProfile: ImpactProfile =
        typeof w.citations === "number" && w.citations > 0
          ? {
              measurable: true,
              signals: [
                {
                  id: "crossref_citations",
                  label: "Times cited",
                  value: w.citations.toLocaleString("en-US"),
                  scope: "artifact",
                  source: "Crossref",
                  sourceUrl: w.url,
                  observedAt,
                },
              ],
            }
          : { measurable: false, reason: "Crossref has not recorded a citation count for this work yet." };

      return {
        id: `crossref:${w.doi}`,
        slug: `crossref-${w.doi!.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
        title: w.title,
        summary: w.published
          ? `Published research record, ${w.published}.`
          : "Published research record.",
        description: `A confirmed Crossref metadata record for "${w.title}"${w.published ? ` (published ${w.published})` : ""}. This is a real, published record - it does not by itself imply RESOLVE or any funder has paid for this work.`,
        type: "research_request",
        status: "confirmed",
        creator: {
          type: "community",
          name: "Published author(s)",
          verified: true,
        },
        skills: [],
        deliverables: [],
        evidenceRequirements: [],
        eligibility: [],
        provider: { preference: "open" },
        publishedAt: w.published ?? observedAt,
        updatedAt: observedAt,
        verificationStatus: "confirmed_external_record",
        riskFlags: [],
        source: { type: "crossref_work", id: w.doi! },
        marketplaceKind: "verified_work",
        sourceUrl: w.url,
        impactProfile,
        entityState: {
          provenance: "external_integration",
          lifecycle: "confirmed",
          financialReadiness: "not_applicable",
        },
        primaryAction: discoverNavigationAction(
          {
            id: "discover.open_external_record",
            label: "View on Crossref",
            href: w.url,
          },
          { target: "external", secondary: true },
        ),
        secondaryActions: [],
      };
    });
}

export async function isResearchSignalSourceHealthy(): Promise<boolean> {
  const result = await pingCrossref();
  return result.ok;
}
