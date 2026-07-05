import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { listProgramsForCommunity, createProgram, updateProgram } from "@/lib/communities/programs";
import { getCommunityBySlug } from "@/lib/communities/catalog";

type Params = { params: Promise<{ slug: string }> };

export const maxDuration = 60;

const createSchema = z.object({
  templateId: z
    .enum([
      "user-centric-royalties",
      "video-royalties",
      "docs-bounty",
      "security-fund",
      "quadratic-funding",
      "citation-toll",
    ])
    .optional(),
  name: z.string().min(1).max(120).optional(),
  budgetUsd: z.number().positive().optional(),
  rules: z
    .object({
      perPlayUsd: z.number().positive().optional(),
      minDurationSec: z.number().min(0).optional(),
    })
    .optional(),
});

const patchSchema = z.object({
  programId: z.string(),
  name: z.string().min(1).max(120).optional(),
  budgetUsd: z.number().positive().optional(),
  status: z.enum(["draft", "active", "paused"]).optional(),
  rules: z
    .object({
      perPlayUsd: z.number().positive().optional(),
    })
    .optional(),
});

export async function GET(_req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { slug } = await params;
  if (!getCommunityBySlug(slug)) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  const programs = await listProgramsForCommunity(ready.user.id, slug);
  return NextResponse.json({ ok: true, programs });
}

export async function POST(req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { slug } = await params;
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid program" }, { status: 400 });
  }

  const result = await createProgram(ready.user.id, slug, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, program: result.program });
}

export async function PATCH(req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }

  const result = await updateProgram(ready.user.id, parsed.data.programId, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, program: result.program });
}
