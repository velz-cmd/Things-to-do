import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ProgramRules } from "@/lib/communities/types";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function parseRules(value: string): ProgramRules {
  try {
    return JSON.parse(value) as ProgramRules;
  } catch {
    return {};
  }
}

function expiresAt(days: number | undefined, activatedAt: Date | null) {
  if (!activatedAt || !days || days <= 0) return null;
  return new Date(activatedAt.getTime() + days * 86_400_000);
}

/**
 * Materialize only benefits explicitly defined by the program. The stake must
 * already be active, so pending or failed Arc deposits never earn benefits.
 */
export async function syncSupporterBenefitsForStake(stakeId: string) {
  const stake = await prisma.communityFundStake.findUnique({
    where: { id: stakeId },
    include: { program: { select: { rulesJson: true, metadataJson: true } } },
  });
  if (!stake || !["active", "target_met"].includes(stake.status)) return [];

  const rules = parseRules(stake.program.rulesJson);
  const benefits = (rules.supporterBenefits ?? []).filter(
    (benefit) => benefit.key.trim() && benefit.label.trim(),
  );
  if (!benefits.length) return [];

  const now = new Date();
  const policyVersion = (() => {
    try {
      const metadata = JSON.parse(stake.program.metadataJson ?? "{}") as { policyVersion?: unknown };
      return typeof metadata.policyVersion === "string" ? metadata.policyVersion : null;
    } catch {
      return null;
    }
  })();

  return prisma.$transaction(benefits.map((benefit) => {
    const active = benefit.activation === "confirmed_deposit";
    const activatedAt = active ? now : null;
    return prisma.supporterBenefitLedger.upsert({
      where: { stakeId_benefitKey: { stakeId, benefitKey: benefit.key } },
      create: {
        stakeId,
        programId: stake.programId,
        userId: stake.userId,
        benefitKey: benefit.key,
        benefitLabel: benefit.label,
        status: active ? "active" : "pending",
        policyVersion,
        activationCheckpointUsd: benefit.activation === "checkpoint" ? benefit.checkpointUsd ?? null : null,
        policySnapshot: json(benefit),
        limitations: benefit.limitations ? json(benefit.limitations) : undefined,
        activatedAt,
        expiresAt: expiresAt(benefit.expiresDays, activatedAt),
      },
      update: {
        benefitLabel: benefit.label,
        policyVersion,
        policySnapshot: json(benefit),
        limitations: benefit.limitations ? json(benefit.limitations) : undefined,
      },
    });
  }));
}

/** Activate checkpoint-gated benefits only after the checkpoint is recorded. */
export async function activateCheckpointSupporterBenefits(programId: string, thresholdUsd: number) {
  const pending = await prisma.supporterBenefitLedger.findMany({
    where: {
      programId,
      status: "pending",
      activationCheckpointUsd: { lte: thresholdUsd },
    },
  });
  if (!pending.length) return 0;

  const activatedAt = new Date();
  await prisma.$transaction(pending.map((benefit) => {
    const policy = benefit.policySnapshot as { expiresDays?: unknown };
    const expiryDays = typeof policy.expiresDays === "number" ? policy.expiresDays : undefined;
    return prisma.supporterBenefitLedger.update({
      where: { id: benefit.id },
      data: {
        status: "active",
        activatedAt,
        expiresAt: expiresAt(expiryDays, activatedAt),
      },
    });
  }));
  return pending.length;
}
