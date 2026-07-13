/** Server-side Arc + Circle configuration. Never import from client components. */

import { normalizeCircleEntitySecret } from "@/lib/wallet/circle-secret";
import { resolveArcRpcUrl } from "@/lib/wallet/arc-rpc-url";
import {
  ARC_TESTNET_CAIP2,
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_EXPLORER_URL,
  ARC_USDC_ADDRESS,
} from "@/lib/arc/config";
import { arcFeatureFlags } from "@/lib/arc/feature-flags";

export const ARC_CHAIN_ID = Number(process.env.ARC_CHAIN_ID ?? ARC_TESTNET_CHAIN_ID);
export { ARC_TESTNET_CAIP2 as ARC_CAIP2 };
export const ARC_RPC_URL = resolveArcRpcUrl();
export const ARC_EXPLORER_URL =
  process.env.ARC_EXPLORER_URL ?? ARC_TESTNET_EXPLORER_URL;
export const ARC_AGENTIC_COMMERCE_CONTRACT = (process.env
  .ARC_AGENTIC_COMMERCE_CONTRACT ??
  "0x0747EEf0706327138c69792bF28Cd525089e4583") as `0x${string}`;
export const ARC_USDC_CONTRACT = (process.env.ARC_USDC_CONTRACT ??
  process.env.ARC_USDC_ADDRESS ??
  ARC_USDC_ADDRESS) as `0x${string}`;

export const ARC_PROVIDER_WALLET_ID = process.env.ARC_PROVIDER_WALLET_ID;
export const ARC_CLIENT_WALLET_ID = process.env.ARC_CLIENT_WALLET_ID;
export const ARC_PROVIDER_WALLET_ADDRESS = process.env
  .ARC_PROVIDER_WALLET_ADDRESS as `0x${string}` | undefined;
export const ARC_CLIENT_WALLET_ADDRESS = process.env
  .ARC_CLIENT_WALLET_ADDRESS as `0x${string}` | undefined;

export function hasCircleCredentials(): boolean {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  const entitySecret = normalizeCircleEntitySecret(process.env.CIRCLE_ENTITY_SECRET);
  return Boolean(apiKey && entitySecret);
}

export function getLiveBlockers(): string[] {
  const blockers: string[] = [];
  if (!arcFeatureFlags.erc8183) {
    blockers.push("ERC-8183 settlement is disabled until testnet checks pass");
  }
  if (!hasCircleCredentials()) {
    blockers.push("Awaiting Circle credentials (CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET)");
  }
  if (!ARC_CLIENT_WALLET_ADDRESS) {
    blockers.push("Awaiting funded Arc client wallet (ARC_CLIENT_WALLET_ADDRESS)");
  }
  if (!ARC_PROVIDER_WALLET_ADDRESS) {
    blockers.push("Awaiting provider wallet (ARC_PROVIDER_WALLET_ADDRESS)");
  }
  return blockers;
}

export function isLiveArcEnabled(): boolean {
  return arcFeatureFlags.erc8183 && hasCircleCredentials() && getLiveBlockers().length === 0;
}

export function explorerTxUrl(txHash: string): string {
  return `${ARC_EXPLORER_URL}/tx/${txHash}`;
}
