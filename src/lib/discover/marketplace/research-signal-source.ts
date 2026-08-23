import { searchCrossrefDetailed, pingCrossref } from "@/lib/integrations/crossref";
import {
  searchOpenAlexWorksDetailed,
  fetchCitingWorksForOpenAlexId,
  pingOpenAlex,
} from "@/lib/integrations/openalex";
import { searchArxivWorksDetailed, pingArxiv } from "@/lib/integrations/arxiv";
import { normalizeDoi, normalizeOpenAlexId, normalizeArxivId } from "@/lib/integrations/canonical-identity";
import { discoverNavigationAction } from "@/lib/discover/marketplace/action-contract";
import { classifySourceHealth } from "@/lib/discover/marketplace/source-health";
import { mergeResearchWorks } from "@/lib/discover/research/merge";
import { detectResearchUncertainties } from "@/lib/discover/research/uncertainty";
import { persistResearchSnapshot, loadStoredResearchWorks } from "@/lib/discover/research/store";
import { OPEN_RESEARCH_QUERIES } from "@/lib/sensors/targets";
import type { MarketplaceOpportunity } from "@/lib/discover/marketplace/contracts";
import type { ImpactProfile, ImpactSignal } from "@/lib/discover/impact/impact-signals";
import type { ResearchWork } from "@/lib/discover/research/types";
import type { ProviderFetchStatus } from "@/lib/discover/research/provider-result";

/**
 * Real research-domain outcomes (Phase 3), sourced from three independent
 * public scholarly registries: Crossref, OpenAlex, and arXiv. Every merged
 * work carries a real DOI/OpenAlex ID/arXiv ID identity (see
 * research/merge.ts - never a title-based guess), real per-source citation
 * counts (never averaged/summed), and real author identity when a source
 * reports one - never "Published author(s)".
 *
 * Research targets are configuration (OPEN_RESEARCH_QUERIES), never
 * AI-generated. Composition round-robins across targets so one topic
 * never fills the whole market - see composeDeterministic().
 *
 * What this proves: a specific published work exists, is citable, and has
 * been cited N times per a named registry's public ledger.
 * What this does not prove: that RESOLVE, or anyone, has funded this work.
 * No `funding` field is set on these items for that reason - citation is
 * evidence, never demand.
 */
const MAX_WORKS_PER_QUERY = 5;
const MAX_TOTAL_WORKS = 24;
const MAX_CITING_LOOKUPS = 5;

function keyForCrossref(doi: string | undefined): string | null {
  return doi ? `doi:${normalizeDoi(doi)}` : null;
}
function keyForOpenAlex(doi: string | undefined, openAlexId: string): string {
  return doi ? `doi:${normalizeDoi(doi)}` : `openalex:${normalizeOpenAlexId(openAlexId)}`;
}
function keyForArxiv(doi: string | undefined, arxivId: string): string {
  return doi ? `doi:${normalizeDoi(doi)}` : `arxiv:${normalizeArxivId(arxivId)}`;
}

/**
 * Deterministic round-robin composition across research targets (Phase 3
 * item 18): a query's own rank never determines global order by itself.
 * Works are bucketed by the first target query that surfaced them, then
 * interleaved one-per-bucket-per-round, with a stable key tie-break
 * inside each bucket - never a popularity/citation-count ranking.
 */
function composeDeterministic(
  works: ResearchWork[],
  queryIndexByKey: Map<string, number>,
  targetCount: number,
): ResearchWork[] {
  const buckets = new Map<number, ResearchWork[]>();
  for (const work of works) {
    const idx = queryIndexByKey.get(work.key) ?? 0;
    if (!buckets.has(idx)) buckets.set(idx, []);
    buckets.get(idx)!.push(work);
  }
  for (const list of buckets.values()) list.sort((a, b) => a.key.localeCompare(b.key));

  const ordered: ResearchWork[] = [];
  for (let round = 0; ordered.length < works.length; round++) {
    let addedThisRound = false;
    for (let i = 0; i < targetCount; i++) {
      const bucket = buckets.get(i);
      if (bucket?.[round]) {
        ordered.push(bucket[round]);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
  }
  return ordered;
}

/**
 * Live multi-provider refresh (Phase 3 Part C): fetches Crossref/OpenAlex/
 * arXiv, merges, and PERSISTS each composed work durably. This is the
 * only function in this module that talks to external providers - it
 * must only ever be invoked by the background cron job
 * (src/app/api/cron/tick/route.ts), never from a normal page render.
 * loadResearchSignals() below is the render-facing, durable-read-only
 * function.
 */
export async function refreshResearchMarket(): Promise<{
  refreshed: number;
  persisted: number;
}> {
  const observedAt = new Date().toISOString();
  const targets = OPEN_RESEARCH_QUERIES;

  // Structured results (ProviderFetchResult) are used throughout instead
  // of plain arrays specifically so health can never be inferred from
  // "result array happened to be empty" - see provider-result.ts (A2).
  const perQuery = await Promise.all(
    targets.map(async (query) => {
      const [crossref, openAlex] = await Promise.all([
        searchCrossrefDetailed(query, MAX_WORKS_PER_QUERY),
        searchOpenAlexWorksDetailed(query, MAX_WORKS_PER_QUERY),
      ]);
      return { crossref, openAlex };
    }),
  );

  // arXiv is queried strictly sequentially across targets, respecting its
  // slower request etiquette - never fired concurrently like Crossref/OpenAlex.
  const arxivPerQuery: Awaited<ReturnType<typeof searchArxivWorksDetailed>>[] = [];
  for (const query of targets) {
    arxivPerQuery.push(await searchArxivWorksDetailed(query, MAX_WORKS_PER_QUERY));
  }

  const crossrefStatus: ProviderFetchStatus = perQuery.some((r) => r.crossref.status !== "ok")
    ? perQuery.every((r) => r.crossref.status !== "ok")
      ? perQuery[0]?.crossref.status ?? "unavailable"
      : "unavailable"
    : "ok";
  const openAlexStatus: ProviderFetchStatus = perQuery.some((r) => r.openAlex.status !== "ok")
    ? perQuery.every((r) => r.openAlex.status !== "ok")
      ? perQuery[0]?.openAlex.status ?? "unavailable"
      : "unavailable"
    : "ok";
  const arxivStatus: ProviderFetchStatus = arxivPerQuery.some((r) => r.status !== "ok")
    ? arxivPerQuery.every((r) => r.status !== "ok")
      ? arxivPerQuery[0]?.status ?? "unavailable"
      : "unavailable"
    : "ok";

  const allCrossref = perQuery.flatMap((r) => r.crossref.records);
  const allOpenAlex = perQuery.flatMap((r) => r.openAlex.records);
  const allArxiv = arxivPerQuery.flatMap((r) => r.records);
  if (!allCrossref.length && !allOpenAlex.length && !allArxiv.length) {
    return { refreshed: 0, persisted: 0 };
  }

  const merged = mergeResearchWorks({
    crossref: allCrossref,
    openAlex: allOpenAlex,
    arxiv: allArxiv,
    observedAt,
  });

  const queryIndexByKey = new Map<string, number>();
  perQuery.forEach(({ crossref, openAlex }, queryIndex) => {
    for (const w of crossref.records) {
      const key = keyForCrossref(w.doi);
      if (key && !queryIndexByKey.has(key)) queryIndexByKey.set(key, queryIndex);
    }
    for (const w of openAlex.records) {
      const key = keyForOpenAlex(w.doi, w.openAlexId);
      if (!queryIndexByKey.has(key)) queryIndexByKey.set(key, queryIndex);
    }
  });
  arxivPerQuery.forEach(({ records }, queryIndex) => {
    for (const w of records) {
      const key = keyForArxiv(w.doi, w.arxivId);
      if (!queryIndexByKey.has(key)) queryIndexByKey.set(key, queryIndex);
    }
  });

  const composed = composeDeterministic(merged, queryIndexByKey, targets.length).slice(
    0,
    MAX_TOTAL_WORKS,
  );

  // Bounded citing-work lookups - never one extra API call per row. Only
  // the works actually surfaced this run, and only up to MAX_CITING_LOOKUPS.
  let citingLookups = 0;
  for (const work of composed) {
    if (!work.openAlexId || citingLookups >= MAX_CITING_LOOKUPS) continue;
    citingLookups += 1;
    try {
      const citing = await fetchCitingWorksForOpenAlexId(work.openAlexId, 3);
      work.citingSample = citing.map((c) => ({ id: c.openAlexId, title: c.title }));
    } catch {
      /* leave citingSample empty - never fabricate a relationship */
    }
  }

  // Real per-provider status (never inferred from result-array length) -
  // a provider that returned HTTP 200 with zero matches is "ok", not
  // indistinguishable from a timeout/500/429.
  const attemptedAt = observedAt;
  for (const work of composed) {
    work.sourceHealth = {
      Crossref: classifySourceHealth({
        lastSuccessfulRefreshAt: work.citations.some((c) => c.source === "Crossref")
          ? observedAt
          : null,
        lastAttemptAt: attemptedAt,
        lastAttemptSucceeded: crossrefStatus === "ok",
        rateLimited: crossrefStatus === "rate_limited",
      }),
      OpenAlex: classifySourceHealth({
        lastSuccessfulRefreshAt: work.citations.some((c) => c.source === "OpenAlex")
          ? observedAt
          : null,
        lastAttemptAt: attemptedAt,
        lastAttemptSucceeded: openAlexStatus === "ok",
        rateLimited: openAlexStatus === "rate_limited",
      }),
      arXiv: classifySourceHealth({
        lastSuccessfulRefreshAt: work.arxivId ? observedAt : null,
        lastAttemptAt: attemptedAt,
        lastAttemptSucceeded: arxivStatus === "ok",
        rateLimited: arxivStatus === "rate_limited",
      }),
    };
  }

  let persisted = 0;
  for (const work of composed) {
    work.uncertainties = detectResearchUncertainties(work);
    const result = await persistResearchSnapshot(work);
    if (result.persisted) persisted += 1;
  }

  return { refreshed: composed.length, persisted };
}

/**
 * Render-facing, durable-read-only (Phase 3 Part C): reads the persisted
 * research market and projects it into MarketplaceOpportunity records.
 * Never calls Crossref/OpenAlex/arXiv - a normal /discover page load must
 * not fan out to external providers. Deterministic ordering by canonical
 * key (stable regardless of DB row order), matching the same tie-break
 * discipline used elsewhere in Discover's sort logic.
 */
export async function loadResearchSignals(): Promise<MarketplaceOpportunity[]> {
  const works = await loadStoredResearchWorks();
  const observedAt = new Date().toISOString();
  return [...works]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((work) => ({ ...work, uncertainties: detectResearchUncertainties(work) }))
    .map((work) => toMarketplaceOpportunity(work, observedAt));
}

/**
 * The one strongest, deterministic default citation fact (Phase 3 item
 * 13): OpenAlex's cited-by graph is the richer default observation (it
 * also backs the citing-work relationships); Crossref remains real,
 * visible corroborating detail in Details - never hidden, never averaged
 * into the default fact.
 */
function primaryImpactSignal(work: ResearchWork, observedAt: string): ImpactSignal[] {
  const ordered = [...work.citations].sort((a, b) =>
    a.source === "OpenAlex" ? -1 : b.source === "OpenAlex" ? 1 : 0,
  );
  return ordered.map((c) => ({
    id: c.source === "OpenAlex" ? "openalex_citations" : "crossref_citations",
    label: `Times cited (${c.source})`,
    value: c.count.toLocaleString("en-US"),
    scope: "artifact",
    source: c.source,
    sourceUrl: work.url,
    observedAt: c.observedAt,
    classification: "observed",
  }));
}

function authorDisplayName(work: ResearchWork): string {
  if (!work.authors.length) return "Author not yet identified";
  if (work.authors.length === 1) return work.authors[0].name;
  return `${work.authors[0].name} et al.`;
}

function publicationSummary(work: ResearchWork): string {
  if (work.publishedDate) return `Published ${work.publishedDate}.`;
  if (work.publicationYear) return `Published ${work.publicationYear}.`;
  return "Published research record.";
}

function toMarketplaceOpportunity(
  work: ResearchWork,
  observedAt: string,
): MarketplaceOpportunity {
  const signals = primaryImpactSignal(work, observedAt);
  const impactProfile: ImpactProfile = signals.length
    ? { measurable: true, signals }
    : {
        measurable: false,
        reason: "No connector has recorded a citation count for this work yet.",
      };

  return {
    id: `research:${work.key}`,
    slug: `research-${work.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    title: work.title,
    summary: publicationSummary(work),
    description: `A confirmed scholarly-registry record for "${work.title}". This is a real, published record - it does not by itself imply RESOLVE or any funder has paid for this work.`,
    type: "research_outcome",
    status: "confirmed",
    creator: {
      type: "individual",
      name: authorDisplayName(work),
      verified: Boolean(work.authors.length),
    },
    skills: [],
    deliverables: [],
    evidenceRequirements: [],
    eligibility: [],
    provider: { preference: "open" },
    // Generic ordering field only (sort/filter compatibility) - never a
    // displayed publication-date claim. A real full date is used when one
    // exists; otherwise this falls back to observation time rather than
    // fabricating a day/month the source never reported. The actual,
    // precision-honest publication date/year for display lives in
    // researchIdentity.publicationDate/publicationYear below.
    publishedAt: work.publishedDate ?? observedAt,
    updatedAt: observedAt,
    verificationStatus: "confirmed_external_record",
    riskFlags: [],
    source: { type: "research_work", id: work.key },
    marketplaceKind: "verified_work",
    sourceUrl: work.url,
    impactProfile,
    researchIdentity: {
      doi: work.doi,
      openAlexId: work.openAlexId,
      arxivId: work.arxivId,
      arxivVersion: work.arxivVersion,
      authors: work.authors,
      containerTitle: work.containerTitle,
      workType: work.workType,
      citations: work.citations,
      citingSample: work.citingSample,
      referencedWorkIds: work.referencedWorkIds,
      publicationDate: work.publishedDate,
      publicationYear: work.publicationYear,
      publicationDatePrecision: work.datePrecision,
      sourceHealth: work.sourceHealth,
      uncertainties: work.uncertainties,
    },
    entityState: {
      provenance: "external_integration",
      lifecycle: "confirmed",
      financialReadiness: "not_applicable",
    },
    // No forced primary CTA (Phase 3 item 23/A4): a research outcome with
    // no real funding match, no monitoring state, and no purchasable
    // citation-resolution action has zero legitimate RESOLVE actions -
    // that is an allowed, honest state, not a gap to paper over with
    // source navigation dressed up as a decision. "View research record"
    // is quiet secondary navigation only, reusing the same
    // discover.open_evidence id the shared row already treats as the
    // quiet source/evidence link.
    primaryAction: undefined,
    secondaryActions: [
      discoverNavigationAction(
        {
          id: "discover.open_evidence",
          label: "View research record",
          href: work.url,
        },
        { target: "external", secondary: true },
      ),
    ],
  };
}

export async function isResearchSignalSourceHealthy(): Promise<boolean> {
  const [crossref, openAlex, arxiv] = await Promise.all([
    pingCrossref(),
    pingOpenAlex(),
    pingArxiv(),
  ]);
  return crossref.ok || openAlex.ok || arxiv.ok;
}
