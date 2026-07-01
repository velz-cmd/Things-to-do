import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { listCommunityVitals } from "@/lib/communities/vitals";
import { getCommunitySensorStatuses } from "@/lib/sensors/status";

type Params = { params: Promise<{ slug: string }> };

/** B2B compliance export — real ledger + vitals JSON (not a cosmetic PDF). */
export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  const sensorStatuses = await getCommunitySensorStatuses();
  const vitalsMap = await listCommunityVitals(sensorStatuses);
  const vitals = vitalsMap[slug];
  const programs = await prisma.resolveProgram.findMany({
    where: { install: { communitySlug: slug } },
    select: {
      id: true,
      name: true,
      templateId: true,
      status: true,
      missionId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const missionIds = programs.map((p) => p.missionId).filter(Boolean) as string[];
  const authorizations =
    missionIds.length > 0
      ? await prisma.paymentAuthorization.findMany({
          where: { missionId: { in: missionIds } },
          select: {
            id: true,
            missionId: true,
            amountUsd: true,
            status: true,
            connectorId: true,
            eventType: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
      : [];

  const totalAuthorizedUsd = authorizations.reduce((s, a) => s + a.amountUsd, 0);
  const settlements = await prisma.missionSettlement.findMany({
    where: missionIds.length ? { missionId: { in: missionIds } } : { id: "__none__" },
    select: {
      id: true,
      missionId: true,
      status: true,
      treasuryAmount: true,
      escrowTxHash: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    kind: "community_compliance_export",
    generatedAt: new Date().toISOString(),
    community: {
      slug: community.slug,
      name: community.name,
      kind: community.kind,
    },
    vitals,
    programs,
    economics: {
      authorizationCount: authorizations.length,
      totalAuthorizedUsd: Math.round(totalAuthorizedUsd * 100) / 100,
      settlementCount: settlements.length,
      onChainSettlements: settlements.filter((s) => s.escrowTxHash?.startsWith("0x")).length,
    },
    authorizations,
    settlements,
    exportNote:
      "Ledger-backed export for B2B / DAO governance. PDF rendering is a client concern; amounts are from PaymentAuthorization and MissionSettlement.",
  });
}
