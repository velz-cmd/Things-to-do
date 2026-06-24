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
    research: "meta-llama/llama-3.3-70b-instruct:free",
    fast: "meta-llama/llama-3.3-70b-instruct:free",
  },
} as const;

export type AiTier = "fast" | "research" | "quality";
