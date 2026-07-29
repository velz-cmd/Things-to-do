import { NextResponse } from "next/server";
import { z } from "zod";

const allowedEvents = [
  "discover_viewed",
  "discover_search_used",
  "discover_filter_applied",
  "opportunity_viewed",
  "opportunity_saved",
  "application_started",
  "application_submitted",
  "provider_viewed",
  "provider_invited",
  "provider_selected",
  "opportunity_funding_started",
  "community_viewed",
  "pool_viewed",
  "pool_contribution_started",
] as const;

const schema = z.object({
  event: z.enum(allowedEvents),
  path: z.string().max(200).optional(),
  properties: z
    .record(z.string(), z.union([z.string().max(80), z.number(), z.boolean()]))
    .optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });
  console.info("[discover-event]", parsed.data.event, parsed.data.properties ?? {});
  return new NextResponse(null, { status: 204 });
}
