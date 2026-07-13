import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { uiUsdNumberToTokenUnits } from "@/lib/money/usdc";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseJson(value: string | null): unknown {
  if (!value) return {};
  try { return JSON.parse(value); } catch { return {}; }
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function ensureProgramPolicyVersion(program: {
  id: string;
  userId: string;
  templateId: string;
  name: string;
  status: string;
  budgetUsd: number;
  rulesJson: string;
}, communitySlug: string) {
  const existing = await prisma.programVersion.findFirst({
    where: { programId: program.id },
    orderBy: { version: "desc" },
  });
  if (existing) {
    const policy = await prisma.policyVersion.findFirst({
      where: { programVersionId: existing.id },
      orderBy: { version: "desc" },
    });
    if (policy) return { programVersion: existing, policyVersion: policy };
  }

  const rules = parseJson(program.rulesJson);
  const snapshot = {
    name: program.name,
    templateId: program.templateId,
    status: program.status,
    budgetUsd: program.budgetUsd,
    communitySlug,
    rules,
  };
  return prisma.$transaction(async (tx) => {
    const programVersion = existing ?? await tx.programVersion.create({
      data: {
        programId: program.id,
        version: 1,
        status: program.status,
        snapshot: toJson(snapshot),
        createdBy: program.userId,
      },
    });
    const policyVersion = await tx.policyVersion.create({
      data: {
        programVersionId: programVersion.id,
        version: 1,
        evidenceRule: toJson({ source: "configured_connector", verifiedOnly: true }),
        eligibilityRule: toJson({ identity: "resolved", payoutDestination: "verified" }),
        allocationRule: toJson(rules),
        settlementRule: toJson({ network: "eip155:5042002", asset: "USDC", humanAuthorization: true }),
        contentHash: hash(snapshot),
        createdBy: program.userId,
      },
    });
    return { programVersion, policyVersion };
  });
}

export async function normalizeCommunityEvidence(input: {
  userId: string;
  communitySlug: string;
  provider?: string;
  sourceConnectionId?: string;
  syncRunId?: string;
}) {
  const install = await prisma.resolveCommunityInstall.findUnique({
    where: { userId_communitySlug: { userId: input.userId, communitySlug: input.communitySlug } },
    include: { programs: true },
  });
  if (!install) return { evidence: 0, obligations: 0 };

  let evidenceCount = 0;
  let obligationCount = 0;
  for (const program of install.programs) {
    if (!program.missionId) continue;
    const rules = parseJson(program.rulesJson) as { connectorId?: string };
    const authorizations = await prisma.paymentAuthorization.findMany({
      where: {
        missionId: program.missionId,
        ...(input.provider && rules.connectorId === input.provider ? { connectorId: input.provider } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    if (!authorizations.length) continue;

    const { programVersion, policyVersion } = await ensureProgramPolicyVersion(program, input.communitySlug);
    for (const authorization of authorizations) {
      const evidence = await prisma.evidence.upsert({
        where: {
          kind_externalId_contentHash: {
            kind: authorization.eventType,
            externalId: authorization.id,
            contentHash: authorization.proofHash,
          },
        },
        create: {
          sourceConnectionId: input.sourceConnectionId,
          syncRunId: input.syncRunId,
          communitySlug: input.communitySlug,
          externalId: authorization.id,
          kind: authorization.eventType,
          subjectRef: program.id,
          actorRef: authorization.payeeKey,
          occurredAt: authorization.createdAt,
          contentHash: authorization.proofHash,
          payload: toJson({
            connectorId: authorization.connectorId,
            payeeKeyType: authorization.payeeKeyType,
            contextLabel: authorization.contextLabel,
            evidence: parseJson(authorization.evidenceJson),
          }),
          confidencePpm: Math.max(0, Math.min(1_000_000, Math.round(authorization.confidence * 1_000_000))),
        },
        update: {
          sourceConnectionId: input.sourceConnectionId,
          syncRunId: input.syncRunId,
        },
      });
      evidenceCount += 1;

      const observed = await prisma.observedIdentity.findUnique({
        where: {
          userId_communitySlug_provider_externalRef: {
            userId: input.userId,
            communitySlug: input.communitySlug,
            provider: authorization.connectorId,
            externalRef: authorization.payeeKey,
          },
        },
      });
      const resolution = observed
        ? await prisma.identityResolution.findFirst({ where: { observedIdentityId: observed.id, newState: "resolved" }, orderBy: { createdAt: "desc" } })
        : null;
      const payout = resolution?.identityId
        ? await prisma.payoutDestination.findFirst({ where: { identityId: resolution.identityId, status: "verified" }, orderBy: { verifiedAt: "desc" } })
        : null;
      const lineageHash = hash({
        evidenceId: evidence.id,
        identityId: resolution?.identityId ?? null,
        policyVersionId: policyVersion.id,
        authorizationId: authorization.id,
        amountMicroUsdc: uiUsdNumberToTokenUnits(authorization.amountUsd).toString(),
      });
      await prisma.obligation.upsert({
        where: { lineageHash },
        create: {
          userId: input.userId,
          communitySlug: input.communitySlug,
          programVersionId: programVersion.id,
          policyVersionId: policyVersion.id,
          identityId: resolution?.identityId ?? null,
          payoutDestinationId: payout?.id ?? null,
          evidenceIds: [evidence.id],
          amountUsdcMicro: uiUsdNumberToTokenUnits(authorization.amountUsd),
          status: !resolution?.identityId
            ? "needs_identity"
            : !payout
              ? "needs_identity"
              : "ready_for_simulation",
          blockerCode: !resolution?.identityId ? "identity_unresolved" : !payout ? "payout_destination_missing" : null,
          lineageHash,
        },
        update: {
          identityId: resolution?.identityId ?? undefined,
          payoutDestinationId: payout?.id ?? undefined,
          status: resolution?.identityId && payout ? "ready_for_simulation" : "needs_identity",
          blockerCode: !resolution?.identityId ? "identity_unresolved" : !payout ? "payout_destination_missing" : null,
        },
      });
      obligationCount += 1;
    }
  }
  return { evidence: evidenceCount, obligations: obligationCount };
}
