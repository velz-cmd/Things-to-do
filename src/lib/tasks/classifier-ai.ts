import { z } from "zod";
import { generateObjectWithFallback, isGroqConfigured } from "@/lib/ai/gateway";
import type { TaskClassification } from "./classifier";

const classificationSchema = z.object({
  category: z.string(),
  company: z.string().nullable(),
  objective: z.string(),
  secondaryObjective: z.string().optional(),
  requiredEvidence: z.array(z.string()),
  requiredConnectors: z.array(z.string()),
  missingInputs: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  isDemo: z.boolean(),
  suggestedTitle: z.string(),
  targetValueUsd: z.number().nullable(),
  merchantId: z.string().nullable(),
  question: z.string().optional(),
});

export function canClassifyWithAi(): boolean {
  return isGroqConfigured();
}

/** Groq fast layer — intent classification with Gemini/Llama fallback inside gateway. */
export async function classifyTaskInputWithAi(
  input: string,
  ruleHint?: TaskClassification,
): Promise<TaskClassification | null> {
  if (!canClassifyWithAi()) return null;

  try {
    const { object } = await generateObjectWithFallback({
      tier: "fast",
      schema: classificationSchema,
      system: `You classify financial outcome missions for RESOLVE (refunds, subscriptions, bounties, founder distributions, parcel claims).
Return JSON only. Categories include: airline_refund, subscription_cancellation, parcel_claim, charge_dispute, wallet_guardian, bounty, distribution, manual.
Use requiredConnectors from: gmail, browser, arc, wallet.`,
      prompt: `User input: ${input}
${ruleHint ? `Rule-based hint (may improve): ${JSON.stringify(ruleHint)}` : ""}`,
    });
    return object as TaskClassification;
  } catch (e) {
    console.warn("AI classification failed:", e);
    return null;
  }
}
