import { searchCrossref, pingCrossref } from "@/lib/integrations/crossref";
import { searchOpenAlexWorks } from "@/lib/integrations/openalex";
import { normalizeDoi } from "@/lib/integrations/canonical-identity";
import { discoverNavigationAction } from "@/lib/discover/marketplace/action-contract";
import type { MarketplaceOpportunity } from "@/lib/discover/marketplace/contracts";
import type { ImpactProfile, ImpactSignal } from "@/lib/discover/impact/impact-signals";

/**
 * Real-money-adjacent research-domain outcomes, sourced from two independent
 * public scholarly registries: Crossref and OpenAlex. Each item is a
 * published work with a real DOI (when either source has one) and a real
 * citation count - not an inference, not a funding claim. Citation counts
 * are surfaced as impact evidence (scope: artifact), never as money, per
 * src/lib/discover/impact/impact-signals.ts.
 *
 * Crossref and OpenAlex frequently index the SAME paper. Every merged
 * record is keyed by its normalized DOI (falling back to its OpenAlex ID
 * only for the rare work with no DOI at all), so the same work never
 * appears twice as two separate "outcomes" just because two different
 * connectors both observed it.
 *
 * What this proves: a specific published work exists, is citable, and has
 * been cited N times per a named registry's public ledger.
 * What this does not prove: that RESOLVE, or anyone, has funded this work.
 * No `funding` field is set on these items for that reason.
 */
const RESEARCH_QUERY = "open source software sustainability funding";
const MAX_WORKS = 8;

type MergedWork = {
  key: string;
  title: string;
  url: string;
  published?: string;
  signals: ImpactSignal[];
};

export async function loadResearchSignals(): Promise<MarketplaceOpportunity[]> {
  const [crossrefWorks, openAlexWorks] = await Promise.all([
    searchCrossref(RESEARCH_QUERY, MAX_WORKS).catch(() => []),
    searchOpenAlexWorks(RESEARCH_QUERY, MAX_WORKS).catch(() => []),
  ]);
  if (!crossrefWorks.length && !openAlexWorks.length) return [];

  const observedAt = new Date().toISOString();
  const byKey = new Map<string, MergedWork>();

  for (const w of crossrefWorks) {
    if (!w.doi) continue;
    const key = normalizeDoi(w.doi);
    const signals: ImpactSignal[] = [];
    if (typeof w.citations === "number" && w.citations > 0) {
      signals.push({
        id: "crossref_citations",
        label: "Times cited (Crossref)",
        value: w.citations.toLocaleString("en-US"),
        scope: "artifact",
        source: "Crossref",
        sourceUrl: w.url,
        observedAt,
        classification: "observed",
      });
    }
    byKey.set(key, { key, title: w.title, url: w.url, published: w.published, signals });
  }

  for (const w of openAlexWorks) {
    const key = w.doi ? normalizeDoi(w.doi) : `openalex:${w.openAlexId}`;
    const existing = byKey.get(key);
    const signal: ImpactSignal | null =
      w.citedByCount > 0
        ? {
            id: "openalex_citations",
            label: "Times cited (OpenAlex)",
            value: w.citedByCount.toLocaleString("en-US"),
            scope: "artifact",
            source: "OpenAlex",
            sourceUrl: w.landingPageUrl ?? w.openAlexId,
            observedAt,
            classification: "observed",
          }
        : null;
    if (existing) {
      if (signal) existing.signals.push(signal);
      continue;
    }
    byKey.set(key, {
      key,
      title: w.title,
      url: w.landingPageUrl ?? w.openAlexId,
      published: w.publicationYear ? String(w.publicationYear) : undefined,
      signals: signal ? [signal] : [],
    });
  }

  return [...byKey.values()].map((w): MarketplaceOpportunity => {
    const impactProfile: ImpactProfile = w.signals.length
      ? { measurable: true, signals: w.signals }
      : {
          measurable: false,
          reason: "No connector has recorded a citation count for this work yet.",
        };

    return {
      id: `research:${w.key}`,
      slug: `research-${w.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      title: w.title,
      summary: w.published
        ? `Published research record, ${w.published}.`
        : "Published research record.",
      description: `A confirmed scholarly-registry record for "${w.title}"${w.published ? ` (published ${w.published})` : ""}. This is a real, published record - it does not by itself imply RESOLVE or any funder has paid for this work.`,
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
      source: { type: "research_work", id: w.key },
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
          label: "View research record",
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
