import { NextResponse } from "next/server";
import { gatherWorkspaceEvidence } from "@/lib/workspace/context";
import {
  buildBriefingHeadline,
  buildSixQuestionAnswers,
} from "@/lib/workspace/economic-os";
import { buildValueConcentrations } from "@/lib/workspace/advisors/concentrations";
import { buildPolicyProposals } from "@/lib/workspace/advisors/policy-proposals";
import { getProtocolWelcome } from "@/lib/workspace/advisors/synthesize";

/** Economic OS payload — six questions, one engine, real evidence only. */
export async function GET() {
  const evidence = await gatherWorkspaceEvidence().catch(() => null);

  if (!evidence) {
    return NextResponse.json({
      ok: true,
      headline: "Observing open ecosystems for value flow.",
      sixQuestions: [],
      ...getProtocolWelcome(),
    });
  }

  const sixQuestions = buildSixQuestionAnswers(evidence);
  const concentrations = buildValueConcentrations(evidence);
  const welcome = getProtocolWelcome({
    concentrations,
    treasuryBalanceUsd: evidence.treasury.balanceUsd,
    ledgerCount: evidence.ledger?.count ?? 0,
  });

  return NextResponse.json({
    ok: true,
    headline: buildBriefingHeadline(sixQuestions),
    sixQuestions,
    concentrations,
    policies: buildPolicyProposals(evidence),
    evidenceAt: evidence.gatheredAt,
    ...welcome,
  });
}
