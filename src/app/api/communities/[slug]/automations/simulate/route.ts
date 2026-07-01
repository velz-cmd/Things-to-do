import { NextResponse } from "next/server";
import { z } from "zod";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { simulateAutomationRule } from "@/lib/automation/simulate";
import type { AutomationTrigger } from "@/lib/automation/types";

type Params = { params: Promise<{ slug: string }> };

const bodySchema = z.object({
  triggerEvent: z.enum(["docs_merge", "play", "citation", "view"]),
  authorizeUsd: z.number().positive(),
  notifyChannel: z.enum(["email", "webhook"]).default("email"),
  sampleEvents: z.number().int().min(1).max(10_000).optional(),
});

/** Simulate projected authorizations for an automation rule (no ledger writes). */
export async function POST(req: Request, { params }: Params) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid simulation" }, { status: 400 });
  }

  const simulation = simulateAutomationRule({
    triggerEvent: parsed.data.triggerEvent as AutomationTrigger,
    authorizeUsd: parsed.data.authorizeUsd,
    notifyChannel: parsed.data.notifyChannel,
    sampleEvents: parsed.data.sampleEvents,
  });

  return NextResponse.json({
    ok: true,
    communitySlug: slug,
    communityKind: community.kind,
    simulation,
  });
}
