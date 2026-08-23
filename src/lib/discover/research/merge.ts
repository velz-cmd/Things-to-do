import "server-only";

import { normalizeDoi, normalizeArxivId, normalizeOpenAlexId } from "@/lib/integrations/canonical-identity";
import type { CrossrefWork } from "@/lib/integrations/crossref";
import type { OpenAlexSearchResult } from "@/lib/integrations/openalex";
import type { ArxivWork } from "@/lib/integrations/arxiv";
import type { ResearchWork, ResearchAuthor } from "./types";

/**
 * Canonical research identity + merge (Phase 3 item 5/11).
 *
 * Priority: DOI > OpenAlex ID > arXiv ID. A record is only ever merged
 * into an existing canonical work when it shares a STRONG identity (an
 * exact DOI, or the exact same OpenAlex/arXiv ID) with that work - never
 * by title similarity, which two genuinely different papers can share.
 *
 * Citation counts from different registries are separate observations,
 * never averaged/summed/picked. A successful zero is real data ("0
 * observed by Crossref"); only a genuinely absent/undefined count means
 * "not reported" and is omitted rather than recorded as zero.
 */

function crossrefAuthorsToResearchAuthors(work: CrossrefWork): ResearchAuthor[] {
  return work.authors.map((a) => ({
    name: [a.givenName, a.familyName].filter(Boolean).join(" "),
    orcid: a.orcid,
  }));
}

function openAlexAuthorsToResearchAuthors(work: OpenAlexSearchResult): ResearchAuthor[] {
  return work.authors.map((a) => ({
    name: a.displayName,
    openAlexAuthorId: a.openAlexAuthorId,
  }));
}

export function mergeResearchWorks(input: {
  crossref: CrossrefWork[];
  openAlex: OpenAlexSearchResult[];
  arxiv: ArxivWork[];
  observedAt: string;
}): ResearchWork[] {
  const { crossref, openAlex, arxiv, observedAt } = input;
  const byKey = new Map<string, ResearchWork>();

  for (const w of crossref) {
    // Crossref records with no DOI have no strong identity in this
    // pipeline - never keyed by title, so kept out rather than risking a
    // false merge or an unstable per-render identity.
    if (!w.doi) continue;
    const key = `doi:${normalizeDoi(w.doi)}`;
    const work: ResearchWork = {
      key,
      title: w.title,
      authors: crossrefAuthorsToResearchAuthors(w),
      url: w.url,
      doi: normalizeDoi(w.doi),
      publicationYear: w.publicationYear,
      publishedDate: w.published,
      datePrecision: w.datePrecision,
      containerTitle: w.containerTitle,
      workType: w.workType,
      citations:
        typeof w.citations === "number"
          ? [{ source: "Crossref", count: w.citations, observedAt }]
          : [],
      referencedWorkIds: [],
      citingSample: [],
      sourceHealth: {},
      uncertainties: [],
      observedSources: ["Crossref"],
    };
    byKey.set(key, work);
  }

  for (const w of openAlex) {
    const key = w.doi ? `doi:${normalizeDoi(w.doi)}` : `openalex:${normalizeOpenAlexId(w.openAlexId)}`;
    const existing = byKey.get(key);
    const citation = { source: "OpenAlex" as const, count: w.citedByCount, observedAt };

    if (existing) {
      existing.openAlexId = w.openAlexId;
      existing.citations.push(citation);
      // OpenAlex actually responded for this work this run - an empty
      // referencedWorkIds array here is authoritative ("no references"),
      // not "we don't know" - see store.ts's use of observedSources.
      existing.referencedWorkIds = w.referencedWorkIds;
      existing.observedSources.push("OpenAlex");
      if (!existing.authors.length) existing.authors = openAlexAuthorsToResearchAuthors(w);
      if (!existing.publicationYear) existing.publicationYear = w.publicationYear;
      if (!existing.containerTitle) existing.containerTitle = w.sourceDisplayName;
      continue;
    }

    byKey.set(key, {
      key,
      title: w.title,
      authors: openAlexAuthorsToResearchAuthors(w),
      url: w.landingPageUrl ?? w.openAlexId,
      doi: w.doi ? normalizeDoi(w.doi) : undefined,
      openAlexId: w.openAlexId,
      publicationYear: w.publicationYear,
      containerTitle: w.sourceDisplayName,
      citations: [citation],
      referencedWorkIds: w.referencedWorkIds,
      citingSample: [],
      sourceHealth: {},
      uncertainties: [],
      observedSources: ["OpenAlex"],
    });
  }

  for (const w of arxiv) {
    const key = w.doi ? `doi:${normalizeDoi(w.doi)}` : `arxiv:${normalizeArxivId(w.arxivId)}`;
    const existing = byKey.get(key);

    if (existing) {
      existing.arxivId = w.arxivId;
      existing.arxivVersion = w.version;
      existing.observedSources.push("arXiv");
      if (!existing.authors.length) existing.authors = w.authors.map((name) => ({ name }));
      continue;
    }

    byKey.set(key, {
      key,
      title: w.title,
      authors: w.authors.map((name) => ({ name })),
      url: w.url,
      doi: w.doi ? normalizeDoi(w.doi) : undefined,
      arxivId: w.arxivId,
      arxivVersion: w.version,
      publicationYear: w.publishedAt ? new Date(w.publishedAt).getUTCFullYear() : undefined,
      publishedDate: w.publishedAt,
      datePrecision: "day",
      citations: [],
      referencedWorkIds: [],
      citingSample: [],
      sourceHealth: {},
      uncertainties: [],
      observedSources: ["arXiv"],
    });
  }

  return [...byKey.values()];
}
