import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { FundingOpportunity } from "@/lib/github/types";

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function evidenceHash(input: {
  repository: string;
  externalId: string;
  kind: string;
  actor: string;
  occurredAt: string;
  sourceUrl: string;
}) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function buildGithubEvidenceRows(input: {
  opportunity: FundingOpportunity;
  fingerprint: string;
  observedAt: string;
  sourceConnectionId?: string | null;
}) {
  const {
    opportunity,
    fingerprint,
    observedAt,
    sourceConnectionId = null,
  } = input;
  return (opportunity.activity?.records ?? []).map((record) => {
    const kind = `github.${record.sourceKind}.${record.category}`;
    const actor = record.actor.toLowerCase();
    return {
      sourceConnectionId,
      communitySlug: null,
      externalId: record.id,
      kind,
      subjectRef: `github:${opportunity.fullName.toLowerCase()}`,
      actorRef: `github:${actor}`,
      occurredAt: new Date(record.occurredAt),
      contentHash: evidenceHash({
        repository: opportunity.fullName.toLowerCase(),
        externalId: record.id,
        kind,
        actor,
        occurredAt: record.occurredAt,
        sourceUrl: record.sourceUrl,
      }),
      sourceUrl: record.sourceUrl,
      payload: json({
        repository: opportunity.fullName,
        workType: record.category,
        sourceKind: record.sourceKind,
        title: record.title,
        snapshotId: fingerprint,
        verificationState: "verified_source",
        freshness: observedAt,
        attributionState: "observed",
      }),
      confidencePpm: 1_000_000,
    } satisfies Prisma.EvidenceCreateManyInput;
  });
}

export async function persistGithubEvidence(input: {
  opportunity: FundingOpportunity;
  fingerprint: string;
  observedAt: string;
  sourceConnectionId?: string | null;
}) {
  const rows = buildGithubEvidenceRows(input);
  if (!rows.length) return [];

  await prisma.evidence.createMany({ data: rows, skipDuplicates: true });
  return prisma.evidence.findMany({
    where: {
      OR: rows.map((row) => ({
        kind: row.kind,
        externalId: row.externalId,
        contentHash: row.contentHash,
      })),
    },
    select: {
      id: true,
      externalId: true,
      kind: true,
      sourceUrl: true,
      occurredAt: true,
      actorRef: true,
    },
  });
}
