import { EntityIds } from "@/lib/domain/entities";
import type { Observation } from "@/lib/domain/observation";
import { bayesianPayeeConfidence } from "@/lib/sensors/confidence";
import { sensorProofHash } from "@/lib/sensors/proof";
import type { SensorProgramContext } from "@/lib/sensors/program-context";
import {
  fetchCollectiveContributions,
  type OpenCollectiveContribution,
} from "@/lib/integrations/opencollective";

/** Open Collective sensor — community contributions → recognized QF signals (RFB #6). */
export async function scanOpenCollectiveContributions(input: {
  program: SensorProgramContext;
  since?: string;
  limit?: number;
}): Promise<Observation[]> {
  const slug =
    input.program.rules.openCollectiveSlug?.trim().toLowerCase() ??
    input.program.communitySlug;

  const contributions = await fetchCollectiveContributions(slug, {
    since: input.since,
    limit: input.limit ?? 100,
  });

  return contributions.map((c) => contributionToObservation(c, input.program));
}

function contributionToObservation(
  c: OpenCollectiveContribution,
  program: SensorProgramContext,
): Observation {
  const idempotencyKey = `opencollective:qf:${c.id}`;
  const projectRef = {
    type: "organization" as const,
    id: EntityIds.opencollectiveProject(c.recipientSlug),
    label: c.recipientName,
  };

  const { confidence } = bayesianPayeeConfidence({
    sensorQuality: 0.9,
    proofStrength: 0.95,
    corroboration: 0.85,
  });

  return {
    id: idempotencyKey,
    idempotencyKey,
    connectorId: "opencollective",
    kind: "community_contribution",
    observedAt: c.createdAt,
    actor: {
      type: "person",
      id: `person:opencollective:${c.contributorSlug}`,
      label: c.contributorName,
    },
    subject: projectRef,
    object: projectRef,
    metrics: {
      amount_hint_usd: c.amountUsd,
      contribution_usd: c.amountUsd,
    },
    confidence,
    proofHash: sensorProofHash(idempotencyKey),
    evidenceRefs: [c.id, `opencollective.com/${c.recipientSlug}`],
    raw: {
      contributorSlug: c.contributorSlug,
      contributorName: c.contributorName,
      recipientSlug: c.recipientSlug,
      recipientName: c.recipientName,
      openCollectiveTxId: c.id,
    },
    missionId: program.missionId,
    policyId: program.templateId,
  };
}
