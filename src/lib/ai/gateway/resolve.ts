import { generateObject, generateText } from "ai";
import type { z } from "zod";
import type { AiTier } from "./models";
import { isCloudflareGatewayConfigured } from "./config";
import { candidatesForTier, type ModelCandidate } from "./providers";

export type AiRunMeta = {
  modelId: string;
  provider: string;
  tier: AiTier;
  attempts: number;
};

export type TextWithMeta = {
  text: string;
  meta: AiRunMeta;
};

export async function generateTextWithFallback(input: {
  tier: AiTier;
  prompt: string;
  system?: string;
  maxOutputTokens?: number;
}): Promise<TextWithMeta> {
  const candidates = candidatesForTier(input.tier);
  if (!candidates.length) {
    throw new Error(`No AI providers configured for tier: ${input.tier}`);
  }

  let lastError: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const result = await generateText({
        model: candidate.model,
        system: input.system,
        prompt: input.prompt,
        maxOutputTokens: input.maxOutputTokens,
      });
      return {
        text: result.text,
        meta: {
          modelId: candidate.id,
          provider: candidate.provider,
          tier: input.tier,
          attempts: i + 1,
        },
      };
    } catch (e) {
      lastError = e;
      console.warn(`[ai:${input.tier}] ${candidate.id} failed:`, e);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`All ${input.tier} providers failed`);
}

export async function generateObjectWithFallback<T extends z.ZodType>(input: {
  tier: AiTier;
  schema: T;
  prompt: string;
  system?: string;
}): Promise<{ object: z.infer<T>; meta: AiRunMeta }> {
  const candidates = candidatesForTier(input.tier);
  if (!candidates.length) {
    throw new Error(`No AI providers configured for tier: ${input.tier}`);
  }

  let lastError: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const result = await generateObject({
        model: candidate.model,
        schema: input.schema,
        system: input.system,
        prompt: input.prompt,
      });
      return {
        object: result.object as z.infer<T>,
        meta: {
          modelId: candidate.id,
          provider: candidate.provider,
          tier: input.tier,
          attempts: i + 1,
        },
      };
    } catch (e) {
      lastError = e;
      console.warn(`[ai:${input.tier}] ${candidate.id} object failed:`, e);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`All ${input.tier} providers failed (object)`);
}

export function listConfiguredProviders(): {
  gemini: boolean;
  groq: boolean;
  openrouter: boolean;
  cloudflareGateway: boolean;
  tiers: Record<AiTier, string[]>;
} {
  const tiers = {
    fast: candidatesForTier("fast").map((c: ModelCandidate) => c.id),
    research: candidatesForTier("research").map((c: ModelCandidate) => c.id),
    quality: candidatesForTier("quality").map((c: ModelCandidate) => c.id),
  };
  return {
    gemini:
      tiers.quality.some((id) => id.startsWith("gemini")) ||
      tiers.fast.some((id) => id.startsWith("gemini")),
    groq: [...tiers.fast, ...tiers.quality, ...tiers.research].some((id) =>
      id.startsWith("groq"),
    ),
    openrouter: [...tiers.fast, ...tiers.research, ...tiers.quality].some((id) =>
      id.startsWith("openrouter"),
    ),
    cloudflareGateway: isCloudflareGatewayConfigured(),
    tiers,
  };
}
