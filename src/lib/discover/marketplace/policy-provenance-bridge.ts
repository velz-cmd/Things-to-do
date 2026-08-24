import "server-only";

import { prisma } from "@/lib/db";

/**
 * Phase 5 Release Slice 9: read-only bridge to the repository's existing,
 * already-persisted ProgramVersion/PolicyVersion system (discovered during
 * Release Slice 2's audit - prisma/schema.prisma, wired through
 * src/lib/obligations/normalize-community.ts).
 *
 * This bridge only READS. It must never call ensureProgramPolicyVersion()
 * or create ProgramVersion/PolicyVersion rows as a side effect of a
 * Discover page load - a page view must never mutate the database.
 * Writing those rows remains the policy engine's job (the separate
 * Communities/Programs settlement flow), not this marketplace read path.
 *
 * DiscoverPool.id is confirmed (by tracing normalizeProgramOpportunity()
 * and listPools() in query.ts) to be the exact same value as the
 * underlying ResolveProgram.id, which is the same string ProgramVersion.programId
 * already uses - the join key genuinely exists.
 */

export type PersistedPolicyProvenance = {
  policyFingerprint: string;
  policyVersion: number;
  provenance: "persisted";
};

/**
 * Release Slice 13: real per-batch availability, distinct from "the lookup
 * succeeded and this Program genuinely has no persisted PolicyVersion yet."
 * A caller must never fold "unavailable" (the query itself failed) into
 * the same bucket as "absent" (queried successfully, no row exists) -
 * ABSENT POLICY != POLICY LOOKUP FAILED. When "unavailable", the returned
 * map is always empty - a caller cannot trust ANY id's absence from it as
 * meaningful in that case, and must label every affected Pool's policy
 * provenance as "unavailable," never silently downgrade it to
 * "provisional."
 */
export type PolicyProvenanceLoadResult = {
  byProgramId: Map<string, PersistedPolicyProvenance>;
  availability: "available" | "unavailable";
};

/**
 * Batch-loads the latest persisted PolicyVersion.contentHash for each real
 * Pool/Program id that has one. A Pool with no ProgramVersion/PolicyVersion
 * yet (most Pools today - this system is not universally adopted) is
 * simply absent from the returned map when the lookup itself succeeded;
 * callers must fall back to a provisional fingerprint
 * (computePolicyFingerprint() in economic-state.ts) rather than treating
 * that absence as an error. A real DB failure is reported via
 * `availability: "unavailable"`, never silently collapsed into the same
 * "absent" bucket.
 */
export async function loadPolicyProvenanceByProgramId(
  programIds: string[],
): Promise<PolicyProvenanceLoadResult> {
  const map = new Map<string, PersistedPolicyProvenance>();
  const ids = [...new Set(programIds.filter((id) => id.trim().length > 0))];
  if (!ids.length || !process.env.DATABASE_URL) {
    return { byProgramId: map, availability: "available" };
  }

  try {
    const programVersions = await prisma.programVersion.findMany({
      where: { programId: { in: ids } },
      orderBy: { version: "desc" },
      select: { id: true, programId: true, version: true },
    });
    if (!programVersions.length) return { byProgramId: map, availability: "available" };

    // Keep only the latest ProgramVersion per program - a program can have
    // several historical versions, only the current one is authoritative.
    const latestProgramVersionByProgram = new Map<
      string,
      { id: string; version: number }
    >();
    for (const pv of programVersions) {
      if (!latestProgramVersionByProgram.has(pv.programId)) {
        latestProgramVersionByProgram.set(pv.programId, {
          id: pv.id,
          version: pv.version,
        });
      }
    }

    const programVersionIds = [...latestProgramVersionByProgram.values()].map(
      (v) => v.id,
    );
    const policyVersions = await prisma.policyVersion.findMany({
      where: { programVersionId: { in: programVersionIds } },
      orderBy: { version: "desc" },
      select: { programVersionId: true, version: true, contentHash: true },
    });
    const latestPolicyByProgramVersionId = new Map<
      string,
      { version: number; contentHash: string }
    >();
    for (const policy of policyVersions) {
      if (!latestPolicyByProgramVersionId.has(policy.programVersionId)) {
        latestPolicyByProgramVersionId.set(policy.programVersionId, {
          version: policy.version,
          contentHash: policy.contentHash,
        });
      }
    }

    for (const [programId, programVersion] of latestProgramVersionByProgram) {
      const policy = latestPolicyByProgramVersionId.get(programVersion.id);
      if (!policy) continue;
      map.set(programId, {
        policyFingerprint: policy.contentHash,
        policyVersion: policy.version,
        provenance: "persisted",
      });
    }
  } catch {
    return { byProgramId: new Map(), availability: "unavailable" };
  }

  return { byProgramId: map, availability: "available" };
}
