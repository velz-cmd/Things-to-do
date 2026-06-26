import { NextResponse } from "next/server";
import { z } from "zod";
import { collectUpstreamUsageSignals } from "@/lib/connectors/upstream";
import { CONNECTOR_API_BINDINGS } from "@/lib/connectors/api-tiers";

const querySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

/** Upstream usage signals for a GitHub repo — Libraries.io, npm, Docker, OpenAlex */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    owner: url.searchParams.get("owner"),
    repo: url.searchParams.get("repo"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
  }

  const signals = await collectUpstreamUsageSignals(parsed.data.owner, parsed.data.repo);
  return NextResponse.json({
    ok: true,
    signals,
    apis: CONNECTOR_API_BINDINGS.filter((a) => a.tier === "tier1" || a.tier === "tier2"),
    updatedAt: new Date().toISOString(),
  });
}
