import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { fundCommunityProgram } from "@/lib/capital/fund-program";
import { bustCapitalStateCache } from "@/lib/capital/state-cache";
import { resolveFundTarget } from "@/lib/discover/fund-target";
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

const bodySchema = z.object({
  package: z.record(z.string(), z.unknown()),
  amountUsd: z.number().positive().optional(),
  skipFund: z.boolean().optional(),
});

export const maxDuration = 60;

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

    let fundTxHash: string | undefined;
    let fundTxLabel: string | undefined;

    if (!parsed.data.skipFund) {
      if (!programId) {
        return NextResponse.json(
          {
            error: "No program installed",
            preview: settlement,
            capitalHref: capitalHandoffFromBlueprint(pkg),
          },
          { status: 422 },
        );
      }

      const program = await prisma.resolveProgram.findUnique({
        where: { id: programId },
        include: { install: { select: { communitySlug: true } } },
      });
      const target = await resolveFundTarget({
        programId,
        communitySlug: program?.install?.communitySlug ?? pkg.communitySlug,
        templateId: program?.templateId,
        userId: ready.profile.id,
      });
      const resolvedProgramId = target?.programId ?? programId;

      const result = await fundCommunityProgram({
        userId: ready.profile.id,
        programId: resolvedProgramId,
        amountUsd: fundAmount,
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, preview: settlement, capitalHref: capitalHandoffFromBlueprint(pkg) },
          { status: 422 },
        );
      }

      fundTxHash = result.txHash ?? undefined;
      fundTxLabel = fundTxHash
        ? `Arc fund · ${fundTxHash.slice(0, 10)}…`
        : (result.message ?? `Pool +$${fundAmount}`);
      await bustCapitalStateCache(ready.profile.id);
    }

    const record = createReportFromPackage(pkg, "authorized", { fundTxLabel }) as MissionReportRecord;
    const stored = await upsertMissionBlueprintReceipt({
      record,
      userId: ready.profile.id,
      settlement,
      evidenceLinks,
      fundTxHash,
      programId: programId ?? null,
    });

    return NextResponse.json({
      ok: true,
      receipt: stored,
      preview: settlement,
      fundTxHash,
      fundTxLabel,
      capitalHref: capitalHandoffFromBlueprint(pkg),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Authorize failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
