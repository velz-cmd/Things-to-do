import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { getProgram, updateProgram } from "@/lib/communities/programs";
import type { ProgramRules } from "@/lib/communities/types";

type RouteContext = { params: Promise<{ slug: string; programId: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  budgetUsd: z.number().positive().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  rules: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(req: Request, context: RouteContext) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { slug, programId } = await context.params;
  const program = await getProgram(ready.profile.id, programId);
  if (!program || program.communitySlug !== slug) return NextResponse.json({ error: "Program not found" }, { status: 404 });
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid policy update" }, { status: 400 });
  const result = await updateProgram(ready.profile.id, programId, {
    ...parsed.data,
    rules: parsed.data.rules as Partial<ProgramRules> | undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, program: result.program });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { slug, programId } = await context.params;
  const program = await getProgram(ready.profile.id, programId);
  if (!program || program.communitySlug !== slug) return NextResponse.json({ error: "Program not found" }, { status: 404 });
  const result = await updateProgram(ready.profile.id, programId, { status: "archived" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, program: result.program });
}
