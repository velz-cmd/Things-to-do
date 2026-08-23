import type { SourceHealthState } from "@/lib/discover/marketplace/source-health";

/**
 * Canonical research work - the merged shape produced from up to three
 * independent provider observations (Crossref, OpenAlex, arXiv). See
 * merge.ts for how per-source records fold into one of these without
 * ever averaging/summing citation counts or false-merging by title.
 */

export type ResearchAuthor = {
  name: string;
  orcid?: string;
  openAlexAuthorId?: string;
};

export type ResearchDatePrecision = "day" | "month" | "year";

/** One provider's own citation observation - never blended with another's. */
export type ResearchCitationObservation = {
  source: "Crossref" | "OpenAlex";
  count: number;
  observedAt: string;
};

export type ResearchCitingWork = {
  id: string;
  title: string;
};

export type ResearchWork = {
  /** Canonical key: doi:<doi> > openalex:<id> > arxiv:<id>. */
  key: string;
  title: string;
  authors: ResearchAuthor[];
  url: string;
  doi?: string;
  openAlexId?: string;
  arxivId?: string;
  arxivVersion?: string;
  publicationYear?: number;
  /** Full date string, only when a source actually provided day/month precision. */
  publishedDate?: string;
  datePrecision?: ResearchDatePrecision;
  containerTitle?: string;
  workType?: string;
  /** Each source's own citation count, never combined into one number. */
  citations: ResearchCitationObservation[];
  /** Bounded sample of this work's own outgoing references (OpenAlex). */
  referencedWorkIds: string[];
  /** Bounded sample of works observed citing this one (OpenAlex `cites:` filter). */
  citingSample: ResearchCitingWork[];
  /** Per-provider health, so "Crossref healthy" never implies "OpenAlex healthy". */
  sourceHealth: Partial<Record<"Crossref" | "OpenAlex" | "arXiv", SourceHealthState>>;
};
