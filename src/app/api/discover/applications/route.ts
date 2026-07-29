import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  DISCOVER_MARKETPLACE_ACTIVITY_CACHE_TAG,
  getMarketplaceOpportunityById,
} from "@/lib/discover/marketplace/query";

const schema = z.object({
  opportunityId: z.string().trim().min(1).max(240),
  proposal: z.string().trim().min(40).max(8_000),
  evidenceLinks: z.array(z.string().url().max(2_000)).max(12).default([]),
});

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Add a proposal of at least 40 characters and valid evidence links." },
      { status: 400 },
    );
  }
  const opportunity = await getMarketplaceOpportunityById(parsed.data.opportunityId);
  if (!opportunity || opportunity.status === "closed") {
    return NextResponse.json({ error: "This opportunity is not open for applications." }, { status: 409 });
  }
  if (opportunity.provider.preference === "invite_only") {
    return NextResponse.json({ error: "This opportunity is invite only." }, { status: 403 });
  }
  const application = await prisma.discoverApplication.upsert({
    where: {
      opportunityId_userId: {
        opportunityId: opportunity.id,
        userId: session.user.id,
      },
    },
    create: {
      opportunityId: opportunity.id,
      userId: session.user.id,
      proposal: parsed.data.proposal,
      evidenceLinks: parsed.data.evidenceLinks,
    },
    update: {
      proposal: parsed.data.proposal,
      evidenceLinks: parsed.data.evidenceLinks,
      status: "submitted",
      submittedAt: new Date(),
    },
  });
  await prisma.discoverOpportunityActivity.create({
    data: {
      opportunityId: opportunity.id,
      eventType: "application_submitted",
      actorId: session.user.id,
      summary: "An application was submitted.",
    },
  });
  revalidateTag(DISCOVER_MARKETPLACE_ACTIVITY_CACHE_TAG);
  return NextResponse.json(
    { applicationId: application.id, status: application.status },
    { status: 201 },
  );
}
