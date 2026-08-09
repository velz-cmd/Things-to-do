import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { fundCommunityProgram } from "@/lib/capital/fund-program";
import { bustCapitalStateCache } from "@/lib/capital/state-cache";
import { publicPaymentError } from "@/lib/copy/payment-errors";
import { resolveFundTarget } from "@/lib/discover/fund-target";
import { prisma } from "@/lib/db";
import {
  ARC_CLIENT_WALLET_ADDRESS,
  isLiveArcEnabled,
} from "@/lib/settlement/arc-config";

export const maxDuration = 60;

function publicFundError(error: unknown) {
  return publicPaymentError(error, "Funding could not complete right now.");
}

const bodySchema = z.object({
  programId: z.string().min(1),
  amountUsd: z.number().positive(),
  targetYieldMultiplier: z.number().min(1).max(10).optional(),
});

const preflightSchema = z.object({
  programId: z.string().trim().min(1),
});

async function poolFundingReadiness(programId: string) {
  const program = await prisma.resolveProgram.findUnique({
    where: { id: programId },
    include: {
      install: { select: { communitySlug: true, status: true } },
    },
  });
  if (!program) {
    return {
      ready: false as const,
      code: "POOL_NOT_FOUND",
      blocker: "This Pool no longer exists.",
    };
  }

  let policyActive = false;
  try {
    const rules = JSON.parse(program.rulesJson) as unknown;
    policyActive = Boolean(
      rules && typeof rules === "object" && !Array.isArray(rules),
    );
  } catch {
    policyActive = false;
  }
  const published =
    program.install.status === "active" &&
    ["active", "deployed"].includes(program.status);
  const allocationLocked = Boolean(program.missionId || program.lastDeployAt);
  const treasuryReady = Boolean(
    isLiveArcEnabled() && ARC_CLIENT_WALLET_ADDRESS,
  );
  const blocker = !published
    ? "This Pool is not published and accepting funds."
    : !policyActive
      ? "This Pool has no valid active allocation policy."
      : !allocationLocked
        ? "This Pool has no locked allocation context."
        : !treasuryReady
          ? "The Arc Testnet Pool treasury is unavailable."
          : null;

  return {
    ready: blocker === null,
    code: blocker ? "POOL_PREFLIGHT_BLOCKED" : "POOL_PREFLIGHT_READY",
    blocker,
    programId: program.id,
    poolName: program.name,
    communitySlug: program.install.communitySlug,
    publicationState: published ? "published" : program.status,
    policyState: policyActive ? "active" : "missing",
    allocationState: allocationLocked ? "locked" : "missing",
    treasuryState: treasuryReady ? "ready" : "unavailable",
    treasuryAddress: treasuryReady ? ARC_CLIENT_WALLET_ADDRESS : null,
    network: "Arc Testnet",
    asset: "USDC",
  };
}

export async function GET(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }
  const url = new URL(req.url);
  const parsed = preflightSchema.safeParse({
    programId: url.searchParams.get("programId"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "INVALID_POOL", error: "A valid Pool is required." },
      { status: 400 },
    );
  }
  const preflight = await poolFundingReadiness(parsed.data.programId);
  return NextResponse.json(
    { ok: preflight.ready, preflight },
    { status: preflight.ready ? 200 : 409 },
  );
}

export async function POST(req: Request) {
  try {
    const ready = await requireReadyUser();
    if ("error" in ready) {
      return NextResponse.json(
        { error: ready.error },
        { status: ready.status },
      );
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid fund request" },
        { status: 400 },
      );
    }

    if (parsed.data.amountUsd < 5) {
      return NextResponse.json(
        { error: "Amount can't be less than $5" },
        { status: 400 },
      );
    }

    const program = await prisma.resolveProgram.findUnique({
      where: { id: parsed.data.programId },
      include: { install: { select: { communitySlug: true } } },
    });
    const target = await resolveFundTarget({
      programId: parsed.data.programId,
      communitySlug: program?.install?.communitySlug,
      templateId: program?.templateId,
      userId: ready.profile.id,
    });
    const programId = target?.programId ?? parsed.data.programId;
    const preflight = await poolFundingReadiness(programId);
    if (!preflight.ready) {
      return NextResponse.json(
        {
          ok: false,
          code: preflight.code,
          error: preflight.blocker,
          preflight,
        },
        { status: 409 },
      );
    }

    const result = await fundCommunityProgram({
      userId: ready.profile.id,
      programId,
      amountUsd: parsed.data.amountUsd,
      targetYieldMultiplier: parsed.data.targetYieldMultiplier,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await bustCapitalStateCache(ready.profile.id);

    return NextResponse.json(result);
  } catch (e) {
    console.error("[capital/fund]", e);
    return NextResponse.json({ error: publicFundError(e) }, { status: 500 });
  }
}
