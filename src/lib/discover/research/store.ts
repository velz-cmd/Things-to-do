import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { isMissingTableError, isPrismaUnavailableError } from "@/lib/db/prisma-errors";
import type { ResearchWork } from "./types";

/**
 * Durable research market storage (Phase 3 Part B).
 *
 * "Latest known good" state per canonical research work, mirroring
 * GithubOssScan's single-row-per-subject pattern (see oss-scan-store.ts).
 * A work falling out of the current target-query top-N does NOT mean the
 * publication ceased to exist - rows are refreshed/merged in place, never
 * deleted on ranking omission (Part B4).
 */

/**
 * Deterministic fingerprint (Part 2): identical semantic state must
 * fingerprint identically regardless of provider response ordering.
 * citations/referencedWorkIds/citingSample have no meaningful order (they
 * are sets/samples, not a sequence a reader depends on) and are sorted
 * before hashing. `authors` is deliberately left in its original order -
 * author order on a scholarly work is meaningful authorship information,
 * never safe to reorder for hashing convenience.
 */
export function computeResearchFingerprint(work: ResearchWork): string {
  const stable = {
    title: work.title,
    authors: work.authors,
    doi: work.doi,
    openAlexId: work.openAlexId,
    arxivId: work.arxivId,
    arxivVersion: work.arxivVersion,
    publishedDate: work.publishedDate,
    publicationYear: work.publicationYear,
    datePrecision: work.datePrecision,
    containerTitle: work.containerTitle,
    workType: work.workType,
    citations: [...work.citations]
      .map((c) => ({ source: c.source, count: c.count }))
      .sort((a, b) => a.source.localeCompare(b.source)),
    referencedWorkIds: [...work.referencedWorkIds].sort(),
    citingSample: [...work.citingSample].sort((a, b) => a.id.localeCompare(b.id)),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

/**
 * Source-aware merge (Part B3, hardened Part 1): a field this run's fetch
 * did not touch is retained from the previous confirmed record, never
 * blanked to undefined/empty just because one provider failed or wasn't
 * re-fetched this run. Participation is decided from `observedSources`/
 * `citingSampleObserved` - explicit "did this provider actually respond
 * this run" flags - never from whether an array happens to be non-empty.
 * An authoritative empty result (provider succeeded, genuinely reports
 * nothing) always replaces stale data; a provider that didn't respond
 * this run never overwrites what was previously confirmed.
 */
export function mergeWithLastConfirmedResearch(
  fresh: ResearchWork,
  previous: ResearchWork | null,
): ResearchWork {
  if (!previous) return fresh;

  const freshSources = new Set(fresh.citations.map((c) => c.source));
  const retainedCitations = previous.citations.filter((c) => !freshSources.has(c.source));

  const openAlexObservedThisRun = fresh.observedSources.includes("OpenAlex");

  return {
    ...fresh,
    title: fresh.title || previous.title,
    url: fresh.url || previous.url,
    authors: fresh.authors.length ? fresh.authors : previous.authors,
    doi: fresh.doi ?? previous.doi,
    openAlexId: fresh.openAlexId ?? previous.openAlexId,
    arxivId: fresh.arxivId ?? previous.arxivId,
    arxivVersion: fresh.arxivVersion ?? previous.arxivVersion,
    publishedDate: fresh.publishedDate ?? previous.publishedDate,
    publicationYear: fresh.publicationYear ?? previous.publicationYear,
    datePrecision: fresh.datePrecision ?? previous.datePrecision,
    containerTitle: fresh.containerTitle ?? previous.containerTitle,
    workType: fresh.workType ?? previous.workType,
    citations: [...fresh.citations, ...retainedCitations],
    // OpenAlex actually responded for this work this run -> its (possibly
    // empty) referencedWorkIds is authoritative and replaces stale data.
    // OpenAlex did not respond this run -> retain the previous sample.
    referencedWorkIds: openAlexObservedThisRun
      ? fresh.referencedWorkIds
      : previous.referencedWorkIds,
    // citingSample is a SEPARATE bounded lookup from the base OpenAlex
    // record fetch - most works never attempt it on a given run, so its
    // own citingSampleObserved flag (not observedSources) decides
    // authoritative-empty vs. retained-stale.
    citingSample: fresh.citingSampleObserved ? fresh.citingSample : previous.citingSample,
    // Both fields intentionally reflect only THIS run's real participants
    // (not a cumulative union) - future merges always read the fresh
    // object's own observedSources/citingSampleObserved to decide
    // retention, exactly like sourceHealth below never being retained.
  };
}

/**
 * Persists one canonical research work, merging against its last confirmed
 * state first (Part B3) so a transient per-provider failure this run
 * never regresses durable state. Never throws on a missing table/DB
 * unavailability - callers must not claim "research updated" when
 * persistence didn't actually happen; the caller (background job) should
 * check/log the outcome, not assume success.
 */
export async function persistResearchSnapshot(
  work: ResearchWork,
): Promise<{ persisted: boolean }> {
  try {
    const existingRow = await prisma.discoverResearchSnapshot.findUnique({
      where: { canonicalKey: work.key },
      select: { payloadJson: true },
    });
    let previous: ResearchWork | null = null;
    if (existingRow?.payloadJson) {
      try {
        previous = JSON.parse(existingRow.payloadJson) as ResearchWork;
      } catch {
        previous = null;
      }
    }

    const merged = mergeWithLastConfirmedResearch(work, previous);
    const now = new Date();

    await prisma.discoverResearchSnapshot.upsert({
      where: { canonicalKey: work.key },
      create: {
        canonicalKey: work.key,
        payloadJson: JSON.stringify(merged),
        fingerprint: computeResearchFingerprint(merged),
        firstObservedAt: now,
        lastObservedAt: now,
        refreshedAt: now,
      },
      update: {
        payloadJson: JSON.stringify(merged),
        fingerprint: computeResearchFingerprint(merged),
        lastObservedAt: now,
        refreshedAt: now,
      },
    });
    return { persisted: true };
  } catch (error) {
    if (isMissingTableError(error) || isPrismaUnavailableError(error)) {
      return { persisted: false };
    }
    throw error;
  }
}

/**
 * Reads the durable research market. Returns an empty array (not a
 * thrown error) when the table is genuinely missing/unavailable, so a
 * cold-start deployment degrades to "no research inventory yet" rather
 * than a hard failure - matching loadStoredOssOpportunities's convention
 * for the equivalent software case.
 */
export async function loadStoredResearchWorks(): Promise<ResearchWork[]> {
  try {
    const rows = await prisma.discoverResearchSnapshot.findMany({
      orderBy: { lastObservedAt: "desc" },
      take: 200,
      select: { payloadJson: true },
    });
    const works: ResearchWork[] = [];
    for (const row of rows) {
      try {
        works.push(JSON.parse(row.payloadJson) as ResearchWork);
      } catch {
        // A corrupt row must not take down the whole read path.
        continue;
      }
    }
    return works;
  } catch (error) {
    if (isMissingTableError(error) || isPrismaUnavailableError(error)) return [];
    throw error;
  }
}
