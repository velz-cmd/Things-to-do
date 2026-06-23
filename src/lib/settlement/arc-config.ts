/** Server-side Arc + Circle configuration. Never import from client components. */

export const ARC_CHAIN_ID = Number(process.env.ARC_CHAIN_ID ?? "5042002");
export const ARC_RPC_URL =
  process.env.ARC_RPC_URL ??
  process.env.ARC_TESTNET_RPC_URL ??
  "https://rpc.testnet.arc.network";
export const ARC_EXPLORER_URL =
  process.env.ARC_EXPLORER_URL ?? "https://testnet.arcscan.app";
export const ARC_AGENTIC_COMMERCE_CONTRACT = (process.env
  .ARC_AGENTIC_COMMERCE_CONTRACT ??
  "0x0747EEf0706327138c69792bF28Cd525089e4583") as `0x${string}`;
export const ARC_USDC_CONTRACT = (process.env.ARC_USDC_CONTRACT ??
  process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x3600000000000000000000000000000000000000") as `0x${string}`;

export const ARC_PROVIDER_WALLET_ID = process.env.ARC_PROVIDER_WALLET_ID;
export const ARC_CLIENT_WALLET_ID = process.env.ARC_CLIENT_WALLET_ID;
export const ARC_PROVIDER_WALLET_ADDRESS = process.env
  .ARC_PROVIDER_WALLET_ADDRESS as `0x${string}` | undefined;
export const ARC_CLIENT_WALLET_ADDRESS = process.env
  .ARC_CLIENT_WALLET_ADDRESS as `0x${string}` | undefined;

export function hasCircleCredentials(): boolean {
  return Boolean(
    process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET
  );
}

export function getLiveBlockers(): string[] {
  const blockers: string[] = [];
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
  return hasCircleCredentials() && getLiveBlockers().length === 0;
}

export function explorerTxUrl(txHash: string): string {
  return `${ARC_EXPLORER_URL}/tx/${txHash}`;
}
