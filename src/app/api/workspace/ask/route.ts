import { NextResponse } from "next/server";
import { z } from "zod";
import { gatherWorkspaceEvidence } from "@/lib/workspace/context";
import { askValueAdvisor, getProtocolWelcome } from "@/lib/workspace/advisors/synthesize";
import { buildValueConcentrations } from "@/lib/workspace/advisors/concentrations";
import { buildPolicyProposals } from "@/lib/workspace/advisors/policy-proposals";
import { opportunitiesToCards } from "@/lib/workspace/advisors/opportunity-cards";
import { buildEvidenceActions } from "@/lib/workspace/advisors/evidence-actions";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const bodySchema = z.object({
  question: z.string().min(1).max(4000).optional(),
  messages: z.array(messageSchema).max(40).optional(),
  ecosystem: z
    .object({
      name: z.string().min(1).max(120),
      keywords: z.array(z.string()).max(12).optional(),
      repos: z
        .array(
          z.object({
            owner: z.string(),
            repo: z.string(),
            fullName: z.string(),
          }),
        )
        .max(20)
        .optional(),
      connectors: z.array(z.string()).max(12).optional(),
    })
    .optional(),
  operatingMode: z
    .enum(["founder", "dao", "maintainer", "creator", "research", "community_manager"])
    .optional(),
  /** Mission chat: skip OSS scan, GitHub live probes, web research, LLM polish. */
  fast: z.boolean().optional(),
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

  const useFast = parsed.data.fast === true;
  const evidence = await gatherWorkspaceEvidence({ light: useFast });
  const result = await askValueAdvisor({
    question: parsed.data.question,
    evidence,
    messages: parsed.data.messages,
    ecosystem: parsed.data.ecosystem,
    operatingMode: parsed.data.operatingMode,
    fast: useFast,
  });

  return NextResponse.json({
    ok: true,
    ...result,
    evidenceAt: evidence.gatheredAt,
  });
}

/** Welcome + live snapshot for hybrid workspace (no scripted AI monologue). */
export async function GET() {
  const evidence = await gatherWorkspaceEvidence().catch(() => null);
  const concentrations = evidence ? buildValueConcentrations(evidence) : [];
  const welcome = getProtocolWelcome(
    evidence
      ? {
          concentrations,
          treasuryBalanceUsd: evidence.treasury.balanceUsd,
          ledgerCount: evidence.ledger?.count ?? 0,
        }
      : undefined,
  );

  if (!evidence) {
    return NextResponse.json({ ok: true, ...welcome, concentrations: [] });
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
    concentrations,
    policies: buildPolicyProposals(evidence),
    opportunities: opportunitiesToCards(evidence.opportunities),
    actions: buildEvidenceActions(evidence),
    evidenceAt: evidence.gatheredAt,
  });
}
