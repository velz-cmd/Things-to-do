import { NextResponse } from "next/server";
import { z } from "zod";
import { gatherWorkspaceEvidence } from "@/lib/workspace/context";
import { askValueAdvisor, getProtocolWelcome } from "@/lib/workspace/advisors/synthesize";
import { buildValueConcentrations } from "@/lib/workspace/advisors/concentrations";
import { buildPolicyProposals } from "@/lib/workspace/advisors/policy-proposals";
import { opportunitiesToCards } from "@/lib/workspace/advisors/opportunity-cards";
import { buildEvidenceActions } from "@/lib/workspace/advisors/evidence-actions";

const bodySchema = z.object({
  question: z.string().min(1).max(4000).optional(),
});

/** Open protocol chat — evidence-backed, never executes without approval. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!parsed.data.question?.trim()) {
    return NextResponse.json({ ok: true, ...getProtocolWelcome() });
  }

  const evidence = await gatherWorkspaceEvidence();
  const result = await askValueAdvisor({ question: parsed.data.question, evidence });

  return NextResponse.json({
    ok: true,
    ...result,
    evidenceAt: evidence.gatheredAt,
  });
}

/** Welcome + live snapshot for hybrid workspace (no scripted AI monologue). */
export async function GET() {
  const welcome = getProtocolWelcome();

  const evidence = await gatherWorkspaceEvidence().catch(() => null);
  if (!evidence) {
    return NextResponse.json({ ok: true, ...welcome });
  }

  return NextResponse.json({
    ok: true,
    ...welcome,
    valueFlow: evidence.ledger
      ? {
          recognizedUsd:
            evidence.ledger.authorizedUsd +
            evidence.ledger.pendingFundingUsd +
            evidence.ledger.claimableUsd,
          claimableUsd: evidence.ledger.claimableUsd,
          settledUsd: evidence.ledger.settledUsd,
          participantCount: evidence.ledger.count,
        }
      : null,
    treasuryBalanceUsd: evidence.treasury.balanceUsd,
    concentrations: buildValueConcentrations(evidence),
    policies: buildPolicyProposals(evidence),
    opportunities: opportunitiesToCards(evidence.opportunities),
    actions: buildEvidenceActions(evidence),
    evidenceAt: evidence.gatheredAt,
  });
}
