import { NextResponse } from "next/server";
import { getSessionUser, requireReadyUser } from "@/lib/auth/session";
import {
  getMissionMemoryForCommunity,
  listMissionBlueprintReceiptsForUser,
} from "@/lib/mission/server/mission-blueprint-receipts";
import { formatMissionMemoryLine } from "@/lib/mission/mission-memory";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const compare = url.searchParams.get("compare");

    if (compare) {
      const [aId, bId] = compare.split(",");
      const { getMissionBlueprintReceipt } = await import(
        "@/lib/mission/server/mission-blueprint-receipts"
      );
      const { diffMissionReceipts } = await import("@/lib/mission/mission-receipt-diff");
      const [a, b] = await Promise.all([
        getMissionBlueprintReceipt(aId?.trim() ?? ""),
        getMissionBlueprintReceipt(bId?.trim() ?? ""),
      ]);
      if (!a || !b) {
        return NextResponse.json({ error: "Receipts not found for compare" }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        diff: diffMissionReceipts(a.package, b.package),
      });
    }

    if (!slug) {
      return NextResponse.json({ error: "slug required" }, { status: 400 });
    }

    const session = await getSessionUser();
    let userId: string | undefined;
    if (session) {
      const ready = await requireReadyUser();
      if (!("error" in ready)) userId = ready.profile.id;
    }

    const last = await getMissionMemoryForCommunity({
      communitySlug: slug,
      userId: userId ?? null,
    });

    let history = null;
    if (userId) {
      history = await listMissionBlueprintReceiptsForUser(userId, 5);
    }

    return NextResponse.json({
      ok: true,
      memory: last ? { receipt: last, line: formatMissionMemoryLine(last) } : null,
      history,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load memory";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
