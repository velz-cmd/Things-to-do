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
  /**
   * Which providers actually contributed a record for THIS work on this
   * run - independent of whether that record had a citation count to
   * report. Required to distinguish "OpenAlex succeeded and authoritatively
   * reports zero referenced/citing works" from "OpenAlex failed this run,"
   * which citation/array-length presence alone cannot distinguish (Part 1).
   */
  observedSources: Array<"Crossref" | "OpenAlex" | "arXiv">;
  /**
   * True only when the (separately bounded, at most MAX_CITING_LOOKUPS
   * per run) citing-work lookup actually succeeded for this work this
   * run - distinct from observedSources including "OpenAlex", since most
   * works' base OpenAlex record refreshes without ever attempting the
   * separate citing-sample call (Part 1).
   */
  citingSampleObserved?: boolean;
  /** Deterministic, structurally-detected uncertainty facts - see uncertainty.ts. Never LLM-classified. */
  uncertainties: ResearchUncertainty[];
};

/**
 * A deterministic fact about unresolved identity/evidence (Phase 3 Part
 * E) - never an LLM's judgment call, and never framed as an error. Index
 * variance between two real registries is expected and normal; this
 * records the fact plainly so a future contextual Agent (Phase 9/10) has
 * real structured state to act on, without inventing a reason to spend
 * money resolving it.
 */
export type ResearchUncertainty =
  | {
      kind: "citation_count_discrepancy";
      sources: Array<"Crossref" | "OpenAlex">;
      values: number[];
    }
  | {
      kind: "doi_unresolved";
      /** What identity IS known, so "unresolved" doesn't read as "unidentified". */
      knownIdentity: "openalex" | "arxiv";
    };
