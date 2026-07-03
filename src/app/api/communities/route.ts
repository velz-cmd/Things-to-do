import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { listCommunitySummaries } from "@/lib/communities/surface";
import { getCommunitySensorStatuses } from "@/lib/sensors/status";

export async function GET() {
  try {
    const ready = await requireReadyUser();
    const userId = "error" in ready ? null : ready.user.id;
    const statuses = await getCommunitySensorStatuses();
    const communities = await listCommunitySummaries(userId, { sensorStatuses: statuses });
    return NextResponse.json({ ok: true, communities, sensorStatuses: statuses });
  } catch (e) {
    console.error("[api/communities]", e);
    const { COMMUNITY_CATALOG } = await import("@/lib/communities/catalog");
    const communities = COMMUNITY_CATALOG.map((c) => ({
      slug: c.slug,
      name: c.name,
      tagline: c.tagline,
      kind: c.kind,
      accent: c.accent,
      featured: c.featured,
      installCta: c.installCta,
      attachShape: c.attachShape,
      upstream: c.upstream,
      installed: false,
      vitals: {
        healthPct: null,
        healthLabel: "Observing",
        fundingTotalUsd: 0,
        fundingLabel: "No verified funding yet",
        openWorkCount: 0,
        programCount: 0,
        topBuilders: [],
        sensor: { gated: true, live: false, ready: false, label: "Observing" },
        observeNarrative: "Catalog preview — connect DATABASE_URL for live vitals.",
        hasLiveData: false,
      },
      hubOps: null,
    }));
    const statuses = await getCommunitySensorStatuses().catch(() => []);
    return NextResponse.json({ ok: true, communities, sensorStatuses: statuses, degraded: true });
  }
}
