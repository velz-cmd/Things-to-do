import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI, google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { gatewayFetch, getGatewayBaseUrl } from "./cloudflare";
import {
  getAppReferer,
  isGeminiConfigured,
  isGroqConfigured,
  isOpenRouterConfigured,
} from "./config";
import { AI_MODELS } from "./models";

export type ModelCandidate = {
  id: string;
  provider: "gemini" | "groq" | "openrouter";
  model: LanguageModel;
};

let groqProvider: ReturnType<typeof createGroq> | null = null;
let openRouterProvider: ReturnType<typeof createOpenAI> | null = null;
let geminiProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getGeminiModel(modelId: string): LanguageModel {
  const gatewayBase = getGatewayBaseUrl("google-ai-studio");
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (gatewayBase && apiKey) {
    if (!geminiProvider) {
      geminiProvider = createGoogleGenerativeAI({
        apiKey,
        baseURL: gatewayBase,
        fetch: gatewayFetch(),
      });
    }
    return geminiProvider(modelId);
  }
  return google(modelId);
}

function getGroq() {
  if (!groqProvider) {
    const apiKey = process.env.GROQ_API_KEY!.trim();
    const baseURL = getGatewayBaseUrl("groq") ?? "https://api.groq.com/openai/v1";
    groqProvider = createGroq({
      apiKey,
      baseURL,
      fetch: gatewayFetch(),
    });
  }
  return groqProvider;
}

function getOpenRouter() {
  if (!openRouterProvider) {
    const apiKey = process.env.OPENROUTER_API_KEY!.trim();
    const baseURL =
      getGatewayBaseUrl("openrouter") ?? "https://openrouter.ai/api/v1";
    openRouterProvider = createOpenAI({
      apiKey,
      baseURL,
      name: "openrouter",
      headers: {
        "HTTP-Referer": getAppReferer(),
        "X-Title": "RESOLVE",
      },
      fetch: gatewayFetch(),
    });
  }
  return openRouterProvider;
}

/** Fast layer — Groq first (intent, tags, routing). */
export function fastCandidates(): ModelCandidate[] {
  const out: ModelCandidate[] = [];
  if (isGroqConfigured()) {
    out.push({
      id: `groq:${AI_MODELS.groq.fast}`,
      provider: "groq",
      model: getGroq()(AI_MODELS.groq.fast),
    });
  }
  if (isGeminiConfigured()) {
    out.push({
      id: `gemini:${AI_MODELS.gemini.fast}`,
      provider: "gemini",
      model: getGeminiModel(AI_MODELS.gemini.fast),
    });
  }
  if (isOpenRouterConfigured()) {
    out.push({
      id: `openrouter:${AI_MODELS.openrouter.fast}`,
      provider: "openrouter",
      model: getOpenRouter().chat(AI_MODELS.openrouter.fast),
    });
  }
  return out;
}

/** Research layer — Llama via OpenRouter (long docs, bulk). */
export function researchCandidates(): ModelCandidate[] {
  const out: ModelCandidate[] = [];
  if (isOpenRouterConfigured()) {
    out.push({
      id: `openrouter:${AI_MODELS.openrouter.research}`,
      provider: "openrouter",
      model: getOpenRouter().chat(AI_MODELS.openrouter.research),
    });
  }
  if (isGroqConfigured()) {
    out.push({
      id: `groq:${AI_MODELS.groq.quality}`,
      provider: "groq",
      model: getGroq()(AI_MODELS.groq.quality),
    });
  }
  if (isGeminiConfigured()) {
    out.push({
      id: `gemini:${AI_MODELS.gemini.quality}`,
      provider: "gemini",
      model: getGeminiModel(AI_MODELS.gemini.quality),
    });
  }
  return out;
}

/** Quality brain — Gemini first (final verdict, plans, reports). */
export function qualityCandidates(): ModelCandidate[] {
  const out: ModelCandidate[] = [];
  if (isGeminiConfigured()) {
    out.push({
      id: `gemini:${AI_MODELS.gemini.quality}`,
      provider: "gemini",
      model: getGeminiModel(AI_MODELS.gemini.quality),
    });
    out.push({
      id: `gemini:${AI_MODELS.gemini.fast}`,
      provider: "gemini",
      model: getGeminiModel(AI_MODELS.gemini.fast),
    });
  }
  if (isGroqConfigured()) {
    out.push({
      id: `groq:${AI_MODELS.groq.quality}`,
      provider: "groq",
      model: getGroq()(AI_MODELS.groq.quality),
    });
  }
  if (isOpenRouterConfigured()) {
    out.push({
      id: `openrouter:${AI_MODELS.openrouter.research}`,
      provider: "openrouter",
      model: getOpenRouter().chat(AI_MODELS.openrouter.research),
    });
  }
  return out;
}

export function candidatesForTier(tier: "fast" | "research" | "quality"): ModelCandidate[] {
  if (tier === "fast") return fastCandidates();
  if (tier === "research") return researchCandidates();
  return qualityCandidates();
}
