import { NextResponse } from "next/server";
import { z } from "zod";
import { buildBlueprintSettlementPreview } from "@/lib/mission/mission-blueprint-settlement";
import type { MissionBlueprintPackage } from "@/lib/mission/mission-blueprint-package";

const bodySchema = z.object({
  package: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    }

    const pkg = parsed.data.package as MissionBlueprintPackage;
    const preview = buildBlueprintSettlementPreview(pkg);

    return NextResponse.json({ ok: true, preview });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Prepare failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
