/** Model IDs per AI tier — hackathon stack. */
export const AI_MODELS = {
  gemini: {
    quality: "gemini-2.5-flash",
    fast: "gemini-2.0-flash",
  },
  groq: {
    fast: "llama-3.1-8b-instant",
    quality: "llama-3.3-70b-versatile",
  },
  openrouter: {
    /** Code Worker — one model, one task (DeepSeek via OpenRouter) */
    code: "deepseek/deepseek-chat",
    research: "meta-llama/llama-3.3-70b-instruct",
    fast: "google/gemini-2.0-flash-001",
  },
} as const;

export type AiTier = "fast" | "research" | "quality" | "code";
