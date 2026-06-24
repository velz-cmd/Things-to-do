import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const user = await prisma.user.findUnique({
    where: { id: ready.user.id },
    select: { taskMemoryJson: true },
  });

  let memory: Record<string, unknown> = {};
  if (user?.taskMemoryJson) {
    try {
      const parsed = JSON.parse(user.taskMemoryJson) as Record<string, unknown>;
      const { appWallet: _appWallet, ...workspace } = parsed;
      memory = workspace;
    } catch {
      memory = {};
    }
  }

  return NextResponse.json({ memory });
}

export async function PATCH(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const body = await req.json().catch(() => ({}));
  const patch = (body as { memory?: Record<string, unknown> }).memory ?? {};

  const existing = await prisma.user.findUnique({
    where: { id: ready.user.id },
    select: { taskMemoryJson: true },
  });

  let prev: Record<string, unknown> = {};
  if (existing?.taskMemoryJson) {
    try {
      prev = JSON.parse(existing.taskMemoryJson) as Record<string, unknown>;
    } catch {
      prev = {};
    }
  }

  const merged: Record<string, unknown> = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (prev.appWallet !== undefined) {
    merged.appWallet = prev.appWallet;
  }

  await prisma.user.update({
    where: { id: ready.user.id },
    data: { taskMemoryJson: JSON.stringify(merged) },
  });

  return NextResponse.json({ ok: true, memory: merged });
}
