import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RESOLVE_PLATFORM_FEE_BPS } from "@/lib/payment/platform-fee";

/** Operator attach pricing — real install meter; Stripe billing layer is next. */
export async function GET() {
  const installs = await prisma.resolveCommunityInstall.count();
  const activePrograms = await prisma.resolveProgram.count({
    where: { status: { in: ["active", "deployed"] } },
  });

  return NextResponse.json({
    ok: true,
    model: "operator_attach",
    tagline: "Install beside upstream tools — sensors authorize, Arc settles, RESOLVE coordinates",
    pricing: {
      currency: "USD",
      settlementBps: RESOLVE_PLATFORM_FEE_BPS,
      saasTiers: [
        { id: "starter", label: "Starter", monthlyUsd: 0, includes: "1 community · sensors · deploy" },
        {
          id: "operator",
          label: "Operator",
          monthlyUsd: 49,
          includes: "5 communities · automation rules · webhooks",
          shipped: "manifest",
        },
        {
          id: "network",
          label: "Network",
          monthlyUsd: 199,
          includes: "Unlimited communities · B2B exports · priority support",
          shipped: "manifest",
        },
      ],
      note: "SaaS invoicing via Stripe is next; settlement bps and deploy fees are live today.",
    },
    network: {
      communityInstalls: installs,
      activePrograms,
    },
    actions: {
      install: "/communities",
      automate: "/discover#value-bubblemap",
      exportExample: "/api/communities/react/export",
      stack: "/stack#platform-revenue",
    },
  });
}
