import type { ResearchUncertainty, ResearchWork } from "./types";

/**
 * Deterministic uncertainty detection (Phase 3 Part E). Pure function
 * over already-merged data - no network calls, no LLM classification.
 * These are facts about what remains unresolved, phrased plainly
 * ("citation indexes report different counts"), never as an alarm
 * ("data conflict detected!").
 *
 * Part 6 audit - deliberately NOT implemented, and why:
 *
 * - "DOI/OpenAlex identity conflict": would require comparing this run's
 *   fresh identity against the PREVIOUSLY persisted identity for the same
 *   arXiv/OpenAlex id (e.g. an arXiv record now declares a different DOI
 *   than it did last run) - real and detectable in principle, but this
 *   function only sees one already-merged ResearchWork, not a fresh/
 *   previous pair. Adding it here would mean silently comparing against
 *   nothing, which is worse than not detecting it. Would need to move
 *   into store.ts's merge, which already has both records.
 * - "author identity ambiguity": no existing signal distinguishes "one
 *   author, confidently identified" from "ambiguous" - there is no
 *   second candidate identity in this data model to compare against.
 * - "arXiv/DOI linkage uncertain": partially covered by doi_unresolved
 *   (arXiv-only identity, no DOI). A genuine "arXiv declares a DOI but no
 *   other source corroborates it" state would need the same fresh/
 *   previous or cross-provider corroboration context doi_unresolved
 *   doesn't have access to either.
 * - "required citation evidence missing": explicitly must exist ONLY
 *   when a real funding/Program policy requires citation evidence.
 *   Research items are not currently gated by any such policy (economic
 *   matching for research has no Program-level citation-evidence
 *   requirement wired in) - so this state cannot be true today. Adding
 *   it now would be exactly the manufactured urgency this phase forbids.
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
