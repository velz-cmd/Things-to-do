export function isGeminiConfigured(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim(),
  );
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function isCloudflareGatewayConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_AI_GATEWAY_ENABLED === "true" &&
      process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
      (process.env.CLOUDFLARE_AI_GATEWAY_ID?.trim() ||
        process.env.CLOUDFLARE_AI_GATEWAY_NAME?.trim()),
  );
}

/** Unity swarm — cross-tier validation (Groq → Llama → Gemini). Opt out with AI_SWARM_ENABLED=false. */
export function isSwarmEnabled(): boolean {
  if (process.env.AI_SWARM_ENABLED === "false") return false;
  const tiers = [
    isGroqConfigured(),
    isOpenRouterConfigured(),
    isGeminiConfigured(),
  ].filter(Boolean).length;
  return tiers >= 2;
}

export function getAppReferer(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "https://things-to-do-eta.vercel.app"
  );
}
