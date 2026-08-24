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
 * Batch-loads the latest persisted PolicyVersion.contentHash for each real
 * Pool/Program id that has one. A Pool with no ProgramVersion/PolicyVersion
 * yet (most Pools today - this system is not universally adopted) is
 * simply absent from the returned map; callers must fall back to a
 * provisional fingerprint (computePolicyFingerprint() in economic-state.ts)
 * rather than treating absence as an error.
 */
export async function loadPolicyProvenanceByProgramId(
  programIds: string[],
): Promise<Map<string, PersistedPolicyProvenance>> {
  const map = new Map<string, PersistedPolicyProvenance>();
  const ids = [...new Set(programIds.filter((id) => id.trim().length > 0))];
  if (!ids.length || !process.env.DATABASE_URL) return map;

  try {
    const programVersions = await prisma.programVersion.findMany({
      where: { programId: { in: ids } },
      orderBy: { version: "desc" },
      select: { id: true, programId: true, version: true },
    });
    if (!programVersions.length) return map;

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
    return new Map();
  }

  return map;
}
