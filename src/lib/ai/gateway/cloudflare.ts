import { getAppReferer } from "./config";

type GatewayProvider = "groq" | "openrouter" | "google-ai-studio";

const PROVIDER_PATHS: Record<GatewayProvider, string> = {
  groq: "groq/openai/v1",
  openrouter: "openrouter/api/v1",
  "google-ai-studio": "google-ai-studio",
};

/** Cloudflare AI Gateway base URL for a provider, or null to call provider directly. */
export function getGatewayBaseUrl(provider: GatewayProvider): string | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const gatewayId =
    process.env.CLOUDFLARE_AI_GATEWAY_ID?.trim() ||
    process.env.CLOUDFLARE_AI_GATEWAY_NAME?.trim() ||
    "resolve";
  if (!accountId) return null;
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/${PROVIDER_PATHS[provider]}`;
}

export function gatewayFetch(): typeof fetch | undefined {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) return undefined;

  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("cf-aig-authorization", `Bearer ${token}`);
    headers.set("http-referer", getAppReferer());
    headers.set("x-title", "RESOLVE");
    return fetch(input, { ...init, headers });
  };
}
