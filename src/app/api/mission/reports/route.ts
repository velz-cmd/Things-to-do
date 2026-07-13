import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, requireReadyUser } from "@/lib/auth/session";
import { buildBlueprintSettlementPreview } from "@/lib/mission/mission-blueprint-settlement";
import { buildMissionEvidenceLinks } from "@/lib/mission/mission-evidence-links";
import {
  createReportFromPackage,
  type MissionReportRecord,
} from "@/lib/mission/mission-report-store";
import type { MissionBlueprintPackage } from "@/lib/mission/mission-blueprint-package";
import { upsertMissionBlueprintReceipt } from "@/lib/mission/server/mission-blueprint-receipts";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { uiUsdNumberToTokenUnits } from "@/lib/money/usdc";
import { appendOperationalEvent } from "@/lib/events/operational-event";

const bodySchema = z.object({
  package: z.record(z.string(), z.unknown()),
  status: z.enum(["simulated", "authorized", "draft"]).default("simulated"),
  fundTxLabel: z.string().optional(),
  fundTxHash: z.string().optional(),
  programId: z.string().nullable().optional(),
});

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid report payload" }, { status: 400 });
    }

    const pkg = parsed.data.package as MissionBlueprintPackage;
    const record = createReportFromPackage(pkg, parsed.data.status, {
      fundTxLabel: parsed.data.fundTxLabel,
    });

    const settlement =
      parsed.data.status !== "draft"
        ? buildBlueprintSettlementPreview(pkg)
        : undefined;
    const evidenceLinks = buildMissionEvidenceLinks(pkg);

    const session = await getSessionUser();
    let userId: string | null = null;
    if (session) {
      const ready = await requireReadyUser();
      if (!("error" in ready)) userId = ready.profile.id;
    }

    const stored = await upsertMissionBlueprintReceipt({
      record: record as MissionReportRecord,
      userId,
      settlement,
      evidenceLinks,
      fundTxHash: parsed.data.fundTxHash,
      programId: parsed.data.programId ?? pkg.programId,
    });

    if (userId) {
      const canonicalSettlement = settlement ?? buildBlueprintSettlementPreview(pkg);
      const payees = pkg.payees.map((payee) => ({
        identityId: payee.label,
        amountMicroUsdc: uiUsdNumberToTokenUnits(payee.owedUsd).toString(),
        reason: payee.source,
        evidenceRecordIds: evidenceLinks.map((link) => link.href),
      }));
      const totalMicroUsdc = uiUsdNumberToTokenUnits(canonicalSettlement.totalUsd);
      const fundingRequirement = uiUsdNumberToTokenUnits(pkg.totalCapitalUsd);

      await prisma.blueprint.upsert({
        where: { missionId_version: { missionId: pkg.id, version: 1 } },
        create: {
          id: pkg.id,
          userId,
          missionId: pkg.id,
          communitySlug: pkg.communitySlug,
          programId: parsed.data.programId ?? pkg.programId ?? null,
          version: 1,
          status: parsed.data.status === "authorized" ? "approved" : parsed.data.status,
          objective: toJson({ text: pkg.objective }),
          evidenceIds: evidenceLinks.map((link) => link.href),
          payees: toJson(payees),
          policy: toJson({ id: pkg.policy ?? "balanced", rationale: pkg.rationale }),
          fundingRequirementUsdcMicro: fundingRequirement,
          settlementPath: toJson(canonicalSettlement),
          contentHash: canonicalSettlement.proofHash,
        },
        update: {
          programId: parsed.data.programId ?? pkg.programId ?? undefined,
          status: parsed.data.status === "authorized" ? "approved" : parsed.data.status,
          evidenceIds: evidenceLinks.map((link) => link.href),
          payees: toJson(payees),
          policy: toJson({ id: pkg.policy ?? "balanced", rationale: pkg.rationale }),
          fundingRequirementUsdcMicro: fundingRequirement,
          settlementPath: toJson(canonicalSettlement),
          contentHash: canonicalSettlement.proofHash,
        },
      });

      if (parsed.data.status !== "draft") {
        await prisma.simulation.upsert({
          where: { blueprintId_version: { blueprintId: pkg.id, version: 1 } },
          create: {
            blueprintId: pkg.id,
            version: 1,
            status: "completed",
            inputHash: canonicalSettlement.proofHash,
            result: toJson(record.simulation ?? {}),
            totalUsdcMicro: totalMicroUsdc,
            fundingGapUsdcMicro: fundingRequirement > totalMicroUsdc
              ? fundingRequirement - totalMicroUsdc
              : BigInt(0),
          },
          update: {
            inputHash: canonicalSettlement.proofHash,
            result: toJson(record.simulation ?? {}),
            totalUsdcMicro: totalMicroUsdc,
            fundingGapUsdcMicro: fundingRequirement > totalMicroUsdc
              ? fundingRequirement - totalMicroUsdc
              : BigInt(0),
          },
        });
      }

      await appendOperationalEvent({
        eventType: parsed.data.status === "draft" ? "blueprint.created" : "simulation.completed",
        aggregateType: "blueprint",
        aggregateId: pkg.id,
        userId,
        communitySlug: pkg.communitySlug,
        correlationId: pkg.id,
        idempotencyKey: `mission-report:${pkg.id}:${parsed.data.status}:${canonicalSettlement.proofHash}`,
        payload: toJson({
          blueprintId: pkg.id,
          simulationVersion: parsed.data.status === "draft" ? null : 1,
          programId: parsed.data.programId ?? pkg.programId ?? null,
          totalMicroUsdc: totalMicroUsdc.toString(),
          contentHash: canonicalSettlement.proofHash,
        }),
      });
    }

    return NextResponse.json({ ok: true, receipt: stored });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
