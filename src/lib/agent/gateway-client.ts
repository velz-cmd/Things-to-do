import { GatewayClient } from "@circle-fin/x402-batching/client";
import {
  GATEWAY_FACILITATOR_TESTNET,
  getAgentGatewayPrivateKey,
  isAgentGatewayEnabled,
} from "@/lib/agent/gateway-config";

let client: GatewayClient | null = null;

export function getAgentGatewayClient(): GatewayClient | null {
  if (!isAgentGatewayEnabled()) return null;
  if (client) return client;

  const privateKey = getAgentGatewayPrivateKey()!;
  const rpcUrl =
    process.env.ARC_RPC_URL?.trim() ||
    process.env.ALCHEMY_API_KEY
      ? `https://arc-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY?.trim()}`
      : "https://rpc.testnet.arc.network";

  client = new GatewayClient({
    chain: "arcTestnet",
    privateKey,
    rpcUrl,
  });

  return client;
}

export async function ensureGatewayDeposit(minUsd = "0.05"): Promise<void> {
  const gateway = getAgentGatewayClient();
  if (!gateway) return;

  const balances = await gateway.getBalances();
  const available = Number(balances.gateway.formattedAvailable);
  if (available >= Number(minUsd)) return;

  const walletBal = Number(balances.wallet.formatted);
  if (walletBal < Number(minUsd)) {
    console.warn(
      `[agent-gateway] Wallet low (${walletBal} USDC) — fund agent key on Arc testnet`
    );
    return;
  }

  await gateway.deposit(minUsd);
}

export { GATEWAY_FACILITATOR_TESTNET };
