import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/auth/session";
import {
  getMarketplaceOpportunityById,
  listDiscoverPeople,
} from "@/lib/discover/marketplace/query";

const schema = z.object({
  opportunityId: z.string().trim().min(1).max(240),
  mode: z.enum(["outcome", "selected_provider", "sponsorship"]),
  amountUsd: z.number().finite().positive().max(1_000_000),
  providerId: z.string().trim().min(1).max(240).optional(),
});

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Funding review input is invalid." }, { status: 400 });
  }
  const opportunity = await getMarketplaceOpportunityById(parsed.data.opportunityId);
  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  }
  let provider:
    | { id: string; name: string; kind: string }
    | undefined;
  if (parsed.data.mode !== "outcome") {
    if (!parsed.data.providerId) {
      return NextResponse.json({ error: "Choose a verified person or agent." }, { status: 400 });
    }
    const providers = await listDiscoverPeople();
    const found = providers.find((candidate) => candidate.id === parsed.data.providerId);
    if (!found) {
      return NextResponse.json({ error: "The selected provider is not publicly verified." }, { status: 409 });
    }
    provider = { id: found.id, name: found.name, kind: found.kind };
  }

  const token = opportunity.reward?.token ?? "USDC";
  const network = opportunity.reward?.network ?? "Arc";
  const createsDeliveryObligation = parsed.data.mode !== "sponsorship";
  return NextResponse.json({
    review: {
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
      },
      mode: parsed.data.mode,
      recipient:
        parsed.data.mode === "outcome"
          ? opportunity.creator.name
          : provider?.name,
      provider,
      purpose:
        parsed.data.mode === "sponsorship"
          ? `Direct sponsorship of ${provider?.name}`
          : `Fund ${opportunity.title}`,
      amountUsd: parsed.data.amountUsd,
      token,
      network,
      fees: {
        platformUsd: null,
        networkUsd: null,
        message: "Exact fees must be calculated by the signing wallet before confirmation.",
      },
      releaseCondition:
        parsed.data.mode === "sponsorship"
          ? "No delivery condition. This is direct sponsorship."
          : opportunity.evidenceRequirements[0] ??
            "Release requires accepted evidence under the opportunity rules.",
      refundCondition:
        parsed.data.mode === "sponsorship"
          ? "Direct sponsorship is not refundable after final authorization."
          : "Refund follows the opportunity rules if the work is not accepted.",
      createsDeliveryObligation,
      reservationNotice:
        parsed.data.mode === "selected_provider"
          ? `This reward is reserved for ${provider?.name} if they accept and complete the opportunity.`
          : null,
      transactionExecuted: false,
      canConfirm: false,
      blocker:
        "Dry-run review only. No wallet transaction is created by Discover.",
    },
  });
}
