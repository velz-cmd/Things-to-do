import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  getMarketplaceOpportunityById,
  listDiscoverPeople,
} from "@/lib/discover/marketplace/query";

const schema = z.object({
  opportunityId: z.string().trim().min(1).max(240),
  providerId: z.string().trim().min(1).max(240),
  mode: z.enum(["preferred", "selected"]),
  note: z.string().trim().max(1_000).optional(),
});

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provider selection is invalid." }, { status: 400 });
  }
  const [opportunity, providers] = await Promise.all([
    getMarketplaceOpportunityById(parsed.data.opportunityId),
    listDiscoverPeople(),
  ]);
  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  }
  if (opportunity.creator.id !== session.user.id) {
    return NextResponse.json({ error: "Only the opportunity owner can select a provider." }, { status: 403 });
  }
  const provider = providers.find((candidate) => candidate.id === parsed.data.providerId);
  if (!provider) {
    return NextResponse.json({ error: "Select a verified public provider." }, { status: 409 });
  }

  await prisma.discoverProviderSelection.updateMany({
    where: { opportunityId: opportunity.id, status: { in: ["preferred", "selected"] } },
    data: { status: "superseded" },
  });
  const selection = await prisma.discoverProviderSelection.create({
    data: {
      opportunityId: opportunity.id,
      providerId: provider.id,
      providerName: provider.name,
      selectedBy: session.user.id,
      mode: parsed.data.mode,
      status: parsed.data.mode,
      note: parsed.data.note,
    },
  });
  await prisma.discoverOpportunity.updateMany({
    where: { id: opportunity.id },
    data:
      parsed.data.mode === "selected"
        ? {
            selectedProviderId: provider.id,
            selectedProviderName: provider.name,
            preferredProviderId: null,
            preferredProviderName: null,
          }
        : {
            preferredProviderId: provider.id,
            preferredProviderName: provider.name,
            selectedProviderId: null,
            selectedProviderName: null,
          },
  });
  await prisma.discoverOpportunityActivity.create({
    data: {
      opportunityId: opportunity.id,
      eventType: `provider_${parsed.data.mode}`,
      actorId: session.user.id,
      summary:
        parsed.data.mode === "selected"
          ? `${provider.name} was selected as the provider.`
          : `${provider.name} was marked as the preferred provider.`,
    },
  });
  return NextResponse.json({
    selectionId: selection.id,
    status: selection.status,
    provider: { id: provider.id, name: provider.name },
  });
}
