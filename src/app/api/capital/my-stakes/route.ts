import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** User's pool contributions — for funded badges across Discover & Communities. */
export async function GET() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const stakes = await prisma.communityFundStake.findMany({
    where: { userId: session.user.id, status: { in: ["active", "released"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      programId: true,
      principalUsd: true,
      createdAt: true,
      program: {
        select: {
          id: true,
          name: true,
          install: { select: { communitySlug: true } },
        },
      },
    },
  });

  const byProgramId: Record<
    string,
    {
      programId: string;
      programName: string;
      communitySlug: string | null;
      totalPrincipalUsd: number;
      lastFundedAt: string;
      stakeCount: number;
    }
  > = {};

  for (const stake of stakes) {
    const pid = stake.programId;
    const existing = byProgramId[pid];
    const principal = Math.round(stake.principalUsd * 100) / 100;
    if (!existing) {
      byProgramId[pid] = {
        programId: pid,
        programName: stake.program.name,
        communitySlug: stake.program.install?.communitySlug ?? null,
        totalPrincipalUsd: principal,
        lastFundedAt: stake.createdAt.toISOString(),
        stakeCount: 1,
      };
    } else {
      existing.totalPrincipalUsd = Math.round((existing.totalPrincipalUsd + principal) * 100) / 100;
      existing.stakeCount += 1;
      if (stake.createdAt.toISOString() > existing.lastFundedAt) {
        existing.lastFundedAt = stake.createdAt.toISOString();
      }
    }
  }

  return NextResponse.json({
    stakes: Object.values(byProgramId),
    byProgramId,
  });
}
