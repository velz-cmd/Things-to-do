import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { getQwenApiKey, getQwenBaseUrl, isQwenConfigured } from "./config";
import { qwenFastModel, type QwenModelId } from "./models";

let standardProvider: ReturnType<typeof createOpenAI> | null = null;
let thinkingProvider: ReturnType<typeof createOpenAI> | null = null;

function getQwenAiSdkProvider(enableThinking = false) {
  if (enableThinking) {
    if (!thinkingProvider) {
      const apiKey = getQwenApiKey();
      if (!apiKey) throw new Error("DASHSCOPE_API_KEY is not configured");
      thinkingProvider = createOpenAI({
        apiKey,
        baseURL: getQwenBaseUrl(),
        name: "qwen",
        fetch: qwenThinkingFetch(),
      });
    }
    return thinkingProvider;
  }

  if (!standardProvider) {
    const apiKey = getQwenApiKey();
    if (!apiKey) throw new Error("DASHSCOPE_API_KEY is not configured");
    standardProvider = createOpenAI({
      apiKey,
      baseURL: getQwenBaseUrl(),
      name: "qwen",
    });
  }
  return standardProvider;
}

export function qwenModel(
  modelId: QwenModelId,
  options?: { enableThinking?: boolean },
): LanguageModel {
  const provider = getQwenAiSdkProvider(options?.enableThinking);
  return provider.chat(modelId);
}

/** Prefer Qwen when configured; otherwise fall back to Gemini. */
export function resolveLanguageModel(
  qwenId: QwenModelId,
  geminiFallback = "gemini-2.0-flash",
): LanguageModel {
  if (isQwenConfigured()) return qwenModel(qwenId);
  return google(geminiFallback);
}

export function resolveFastModel(): LanguageModel {
  return resolveLanguageModel(qwenFastModel());
}

function qwenThinkingFetch(): typeof fetch {
  return async (input, init) => {
    let nextInit = init;
    if (init?.body && typeof init.body === "string") {
      try {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        body.enable_thinking = true;
        nextInit = { ...init, body: JSON.stringify(body) };
      } catch {
        /* pass through */
      }
    }
    return fetch(input, nextInit);
  };
}
