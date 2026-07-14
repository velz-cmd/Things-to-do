import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const authUser = await getSessionUser();
  if (!authUser) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const run = await prisma.actionRun.findFirst({
    where: { id, userId: authUser.id },
    select: {
      id: true,
      actionId: true,
      state: true,
      output: true,
      errorCode: true,
      errorMessage: true,
      startedAt: true,
      completedAt: true,
    },
  });
  if (!run) return NextResponse.json({ ok: false, error: "Action run not found." }, { status: 404 });
  return NextResponse.json({
    ok: true,
    actionRun: {
      ...run,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
    },
  });
}
