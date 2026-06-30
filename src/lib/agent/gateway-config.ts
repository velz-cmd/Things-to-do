/** Circle Agent Stack / Gateway nanopayment configuration (server-only). */

import { ARC_CLIENT_WALLET_ADDRESS } from "@/lib/settlement/arc-config";

export const GATEWAY_FACILITATOR_TESTNET =
  "https://gateway-api-testnet.circle.com";

export function getAgentGatewayPrivateKey(): `0x${string}` | null {
  const key =
    process.env.ARC_AGENT_GATEWAY_PRIVATE_KEY?.trim() ||
    process.env.DEPUTY_ORACLE_PRIVATE_KEY?.trim();
  if (!key || !/^0x[a-fA-F0-9]{64}$/.test(key)) return null;
  return key as `0x${string}`;
}

export function isAgentGatewayEnabled(): boolean {
  return Boolean(getAgentGatewayPrivateKey());
}

export function getAgentX402PremiumUrl(): string | null {
  const explicit = process.env.AGENT_X402_PREMIUM_URL?.trim();
  if (explicit) return explicit;

  const app =
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!app) return null;
  return `${app}/api/x402/premium-research`;
}

export function getAgentSentimentUrl(): string | null {
  const explicit = process.env.AGENT_X402_SENTIMENT_URL?.trim();
  if (explicit) return explicit;
  const app = getAppBaseUrl();
  if (!app || app === "http://localhost:3000") return null;
  return `${app}/api/x402/sentiment`;
}

export function getX402SellerAddress(): string | null {
  return (
    process.env.ARC_AGENT_GATEWAY_SELLER_ADDRESS?.trim() ||
    ARC_CLIENT_WALLET_ADDRESS ||
    null
  );
}

export function getDefaultPaidSourcePriceUsd(): number {
  const raw = Number(process.env.AGENT_X402_DEFAULT_PRICE_USD ?? "0.007");
  return Number.isFinite(raw) && raw > 0 ? raw : 0.007;
}

export function getAppBaseUrl(): string {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function getSentimentPriceUsd(): number {
  const raw = Number(process.env.AGENT_X402_SENTIMENT_PRICE_USD ?? "0.001");
  return Number.isFinite(raw) && raw > 0 ? raw : 0.001;
}
