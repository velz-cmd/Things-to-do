import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { listProgramsForCommunity } from "@/lib/communities/programs";
import { listPublicCapitalPrograms } from "@/lib/communities/public-programs";
import { measureProgramOutcomes } from "@/lib/communities/measure-learn";
import { prisma } from "@/lib/db";

/** Capital ↔ Programs — public catalog + signed-in installs */
export async function GET() {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    try {
      const programs = await listPublicCapitalPrograms();
      return NextResponse.json({ ok: true, public: true, programs });
    } catch (e) {
      console.error("[capital/programs] public catalog", e);
      return NextResponse.json({
        ok: true,
        public: true,
        programs: [],
        emptyReason: "Connect DATABASE_URL to list community programs.",
      });
    }
  }

  const installs = await prisma.resolveCommunityInstall.findMany({
    where: { userId: ready.user.id },
    include: { programs: { orderBy: { updatedAt: "desc" } } },
  });

  const programs = [];
  for (const install of installs) {
    const communityPrograms = await listProgramsForCommunity(ready.user.id, install.communitySlug);
    for (const p of communityPrograms) {
      const measure = await measureProgramOutcomes(ready.user.id, p.id);
      programs.push({
        ...p,
        communitySlug: install.communitySlug,
        measure: measure
          ? {
              authorizedUsd: measure.metrics.authorizedUsd,
              settledUsd: measure.metrics.settledUsd,
              playCount: measure.metrics.playCount,
              settlementRate: measure.metrics.settlementRate,
            }
          : null,
      });
    }
  }

  return NextResponse.json({ ok: true, programs });
}
