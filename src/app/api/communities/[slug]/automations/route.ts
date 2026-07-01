import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import {
  createAutomationRule,
  getLiveAutomationRule,
  listAutomationRules,
} from "@/lib/automation/rules";
import { listTriggerOptions } from "@/lib/automation/simulate";
import type { AutomationTrigger } from "@/lib/automation/types";

type Params = { params: Promise<{ slug: string }> };

const createSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  triggerEvent: z.enum(["docs_merge", "play", "citation", "view"]),
  authorizeUsd: z.number().positive(),
  notifyChannel: z.enum(["email", "webhook"]),
  notifyTarget: z.string().min(3).max(500),
  programId: z.string().optional(),
  enable: z.boolean().optional(),
});

/** List automation rules + trigger catalog for a community. */
export async function GET(_req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { slug } = await params;
  if (!getCommunityBySlug(slug)) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  const [rules, live] = await Promise.all([
    listAutomationRules(ready.user.id, slug),
    getLiveAutomationRule(ready.user.id, slug),
  ]);

  return NextResponse.json({
    ok: true,
    communitySlug: slug,
    rules,
    liveRule: live,
    triggers: listTriggerOptions(),
    notifyEmail: ready.user.email ?? null,
  });
}

/** Create and enable one automation rule (disables other live rules for community). */
export async function POST(req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { slug } = await params;
  if (!getCommunityBySlug(slug)) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid automation rule" }, { status: 400 });
  }

  const notifyTarget =
    parsed.data.notifyChannel === "email" && !parsed.data.notifyTarget.includes("@")
      ? ready.user.email ?? parsed.data.notifyTarget
      : parsed.data.notifyTarget;

  if (!notifyTarget) {
    return NextResponse.json({ error: "notifyTarget or user email required" }, { status: 400 });
  }

  const result = await createAutomationRule(ready.user.id, slug, {
    ...parsed.data,
    triggerEvent: parsed.data.triggerEvent as AutomationTrigger,
    notifyTarget,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, rule: result.rule });
}
