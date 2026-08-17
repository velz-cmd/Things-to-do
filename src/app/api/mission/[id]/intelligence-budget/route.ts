import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  grantMissionBudget,
  microToUsd,
  missionBudgetState,
  resumeMissionBudget,
  revokeMissionBudget,
  usdToMicro,
} from "@/lib/mission/intelligence-budget";

type Params = { params: Promise<{ id: string }> };

function serialize(state: Awaited<ReturnType<typeof missionBudgetState>>) {
  return {
    grantedUsd: microToUsd(state.grantedMicro),
    perPurchaseLimitUsd: microToUsd(state.perPurchaseLimitMicro),
    reservedUsd: microToUsd(state.reservedMicro),
    submittedUsd: microToUsd(state.submittedMicro),
    confirmedUsd: microToUsd(state.confirmedMicro),
    committedUsd: microToUsd(state.committedMicro),
    availableUsd: microToUsd(state.availableMicro),
    revoked: state.revoked,
  };
}

async function verifyOwnership(userId: string, missionId: string) {
  const mission = await prisma.resolveMission.findFirst({
    where: { id: missionId, userId },
    select: { id: true },
  });
  return Boolean(mission);
}

export async function GET(_request: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }
  const { id } = await params;
  if (!(await verifyOwnership(ready.profile.id, id))) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, budget: serialize(await missionBudgetState(id)) });
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("grant"),
    budgetUsd: z.number().finite().min(0).max(5),
    perPurchaseUsd: z.number().finite().min(0).max(1),
  }),
  z.object({ action: z.literal("revoke") }),
  z.object({ action: z.literal("resume") }),
]);

export async function POST(request: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }
  const { id } = await params;
  if (!(await verifyOwnership(ready.profile.id, id))) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (parsed.data.action === "grant") {
    const result = await grantMissionBudget({
      missionId: id,
      budgetMicro: usdToMicro(parsed.data.budgetUsd),
      perPurchaseMicro: usdToMicro(parsed.data.perPurchaseUsd),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, budget: serialize(result.state) });
  }

  if (parsed.data.action === "revoke") {
    const state = await revokeMissionBudget(id);
    return NextResponse.json({ ok: true, budget: serialize(state) });
  }

  const state = await resumeMissionBudget(id);
  return NextResponse.json({ ok: true, budget: serialize(state) });
}
