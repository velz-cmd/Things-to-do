import type { ResearchUncertainty, ResearchWork } from "./types";

/**
 * Deterministic uncertainty detection (Phase 3 Part E). Pure function
 * over already-merged data - no network calls, no LLM classification.
 * These are facts about what remains unresolved, phrased plainly
 * ("citation indexes report different counts"), never as an alarm
 * ("data conflict detected!").
 */
export function detectResearchUncertainties(work: ResearchWork): ResearchUncertainty[] {
  const uncertainties: ResearchUncertainty[] = [];

  const distinctCounts = new Set(work.citations.map((c) => c.count));
  if (work.citations.length >= 2 && distinctCounts.size > 1) {
    uncertainties.push({
      kind: "citation_count_discrepancy",
      sources: work.citations.map((c) => c.source),
      values: work.citations.map((c) => c.count),
    });
  }

  if (!work.doi) {
    if (work.openAlexId) {
      uncertainties.push({ kind: "doi_unresolved", knownIdentity: "openalex" });
    } else if (work.arxivId) {
      uncertainties.push({ kind: "doi_unresolved", knownIdentity: "arxiv" });
    }
  }

  return uncertainties;
}

/** Plain, non-alarming user-facing sentence for one uncertainty fact. */
export function describeResearchUncertainty(uncertainty: ResearchUncertainty): string {
  switch (uncertainty.kind) {
    case "citation_count_discrepancy":
      return "Citation indexes report different counts.";
    case "doi_unresolved":
      return `No DOI is confirmed for this work - identity is currently based on its ${
        uncertainty.knownIdentity === "openalex" ? "OpenAlex" : "arXiv"
      } record.`;
  }
}
