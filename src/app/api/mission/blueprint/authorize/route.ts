import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { buildBlueprintSettlementPreview } from "@/lib/mission/mission-blueprint-settlement";
import { buildMissionEvidenceLinks } from "@/lib/mission/mission-evidence-links";
import {
  createReportFromPackage,
  type MissionReportRecord,
} from "@/lib/mission/mission-report-store";
import type { MissionBlueprintPackage } from "@/lib/mission/mission-blueprint-package";
import { upsertMissionBlueprintReceipt } from "@/lib/mission/server/mission-blueprint-receipts";
import { capitalHandoffFromBlueprint } from "@/lib/mission/mission-handoff";
import { uiUsdNumberToTokenUnits } from "@/lib/money/usdc";
import { appendOperationalEvent } from "@/lib/events/operational-event";

const bodySchema = z.object({
  package: z.record(z.string(), z.unknown()),
  amountUsd: z.number().positive().optional(),
  /** Legacy input retained for client compatibility. Mission never executes funding. */
  skipFund: z.boolean().optional(),
});

export const maxDuration = 60;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(req: Request) {
  try {
    const ready = await requireReadyUser();
    if ("error" in ready) {
      return NextResponse.json({ error: ready.error }, { status: ready.status });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid authorize payload" }, { status: 400 });
    }

    const pkg = parsed.data.package as MissionBlueprintPackage;
    const fundAmount = Math.max(
      5,
      Math.round(parsed.data.amountUsd ?? pkg.totalCapitalUsd ?? 500),
    );
    const programId = pkg.programId;
    const settlement = buildBlueprintSettlementPreview(pkg);
    const evidenceLinks = buildMissionEvidenceLinks(pkg);
    const record = createReportFromPackage(pkg, "authorized", {
      fundTxLabel: "Authorization package prepared for Capital",
    }) as MissionReportRecord;
    const stored = await upsertMissionBlueprintReceipt({
      record,
      userId: ready.profile.id,
      settlement,
      evidenceLinks,
      programId: programId ?? null,
    });

    const amountUsdcMicro = uiUsdNumberToTokenUnits(fundAmount);
    const totalUsdcMicro = uiUsdNumberToTokenUnits(settlement.totalUsd);
    const idempotencyKey =
      req.headers.get("idempotency-key")?.trim() ||
      `mission:${pkg.id}:funding:${ready.profile.id}`;

    const fundingIntent = await prisma.fundingIntent.upsert({
      where: { idempotencyKey },
      create: {
        userId: ready.profile.id,
        blueprintId: pkg.id,
        communitySlug: pkg.communitySlug,
        programId: programId ?? null,
        amountUsdcMicro,
        status: "prepared",
        idempotencyKey,
        returnTo: `/mission/report/${encodeURIComponent(pkg.id)}`,
      },
      update: {
        amountUsdcMicro,
        programId: programId ?? undefined,
        status: "prepared",
      },
    });

    await prisma.blueprint.upsert({
      where: { missionId_version: { missionId: pkg.id, version: 1 } },
      create: {
        id: pkg.id,
        userId: ready.profile.id,
        missionId: pkg.id,
        communitySlug: pkg.communitySlug,
        programId: programId ?? null,
        version: 1,
        status: "approved",
        objective: toJson({ text: pkg.objective }),
        evidenceIds: evidenceLinks.map((link) => link.href),
        payees: toJson(pkg.payees.map((payee) => ({
          identityId: payee.label,
          amountMicroUsdc: uiUsdNumberToTokenUnits(payee.owedUsd).toString(),
          reason: payee.source,
          evidenceRecordIds: evidenceLinks.map((link) => link.href),
        }))),
        policy: toJson({ id: pkg.policy ?? "balanced", rationale: pkg.rationale }),
        fundingRequirementUsdcMicro: amountUsdcMicro,
        settlementPath: toJson(settlement),
        contentHash: settlement.proofHash,
      },
      update: {
        status: "approved",
        payees: toJson(pkg.payees.map((payee) => ({
          identityId: payee.label,
          amountMicroUsdc: uiUsdNumberToTokenUnits(payee.owedUsd).toString(),
          reason: payee.source,
          evidenceRecordIds: evidenceLinks.map((link) => link.href),
        }))),
        policy: toJson({ id: pkg.policy ?? "balanced", rationale: pkg.rationale }),
        fundingRequirementUsdcMicro: amountUsdcMicro,
        settlementPath: toJson(settlement),
        contentHash: settlement.proofHash,
      },
    });

    await prisma.simulation.upsert({
      where: { blueprintId_version: { blueprintId: pkg.id, version: 1 } },
      create: {
        blueprintId: pkg.id,
        version: 1,
        status: "completed",
        inputHash: settlement.proofHash,
        result: toJson(record.simulation ?? {}),
        totalUsdcMicro,
        fundingGapUsdcMicro: amountUsdcMicro > totalUsdcMicro
          ? amountUsdcMicro - totalUsdcMicro
          : BigInt(0),
      },
      update: {
        result: toJson(record.simulation ?? {}),
        totalUsdcMicro,
        fundingGapUsdcMicro: amountUsdcMicro > totalUsdcMicro
          ? amountUsdcMicro - totalUsdcMicro
          : BigInt(0),
      },
    });

    await appendOperationalEvent({
      eventType: "mission.authorization_prepared",
      aggregateType: "blueprint",
      aggregateId: pkg.id,
      userId: ready.profile.id,
      communitySlug: pkg.communitySlug,
      correlationId: fundingIntent.id,
      idempotencyKey: `mission-authorization:${pkg.id}:${ready.profile.id}`,
      payload: toJson({
        blueprintId: pkg.id,
        fundingIntentId: fundingIntent.id,
        programId,
        amountUsdcMicro: amountUsdcMicro.toString(),
      }),
    });

    const capitalHref = capitalHandoffFromBlueprint(pkg, {
      fundingIntentId: fundingIntent.id,
      returnTo: `/mission/report/${encodeURIComponent(pkg.id)}`,
    });

    return NextResponse.json({
      ok: true,
      receipt: stored,
      preview: settlement,
      fundingIntentId: fundingIntent.id,
      fundTxLabel: "Prepared for Capital",
      capitalHref,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authorization preparation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
