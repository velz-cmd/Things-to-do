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

const bodySchema = z.object({
  package: z.record(z.string(), z.unknown()),
  status: z.enum(["simulated", "authorized", "draft"]).default("simulated"),
  fundTxLabel: z.string().optional(),
  fundTxHash: z.string().optional(),
  programId: z.string().nullable().optional(),
});

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

    return NextResponse.json({ ok: true, receipt: stored });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
