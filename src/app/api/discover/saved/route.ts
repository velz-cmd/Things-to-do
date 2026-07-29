import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { API_CACHE } from "@/lib/api/cache-headers";

const schema = z.object({
  targetType: z.enum(["opportunity", "person", "community", "pool"]),
  targetId: z.string().trim().min(1).max(240),
});

async function input(request: Request) {
  return schema.safeParse(await request.json().catch(() => null));
}

export async function GET() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }
  const items = await prisma.discoverSavedItem.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  const response = NextResponse.json({ items });
  response.headers.set("Cache-Control", API_CACHE.noStore);
  return response;
}

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }
  const parsed = await input(request);
  if (!parsed.success) {
    return NextResponse.json({ error: "Saved item is invalid" }, { status: 400 });
  }
  const item = await prisma.discoverSavedItem.upsert({
    where: {
      userId_targetType_targetId: {
        userId: session.user.id,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
      },
    },
    create: { userId: session.user.id, ...parsed.data },
    update: {},
  });
  return NextResponse.json({ item }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }
  const parsed = await input(request);
  if (!parsed.success) {
    return NextResponse.json({ error: "Saved item is invalid" }, { status: 400 });
  }
  await prisma.discoverSavedItem.deleteMany({
    where: { userId: session.user.id, ...parsed.data },
  });
  return NextResponse.json({ ok: true });
}
