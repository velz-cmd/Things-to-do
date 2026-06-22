import {
  createPublicClient,
  createWalletClient,
  http,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  arcTestnet,
  DEPUTY_ESCROW_ABI,
  DEPUTY_ESCROW_ADDRESS,
} from "@/lib/arc/config";

function getOracleAccount() {
  const pk = process.env.DEPUTY_ORACLE_PRIVATE_KEY;
  if (!pk) return null;
  return privateKeyToAccount(pk as `0x${string}`);
}

export async function settleOnArc(
  onChainTaskId: number,
  proofHash: `0x${string}`
): Promise<Hash | null> {
  const escrow = DEPUTY_ESCROW_ADDRESS;
  const account = getOracleAccount();
  if (!escrow || !account) return null;

  const transport = http(process.env.ARC_TESTNET_RPC_URL);
  const wallet = createWalletClient({
    account,
    chain: arcTestnet,
    transport,
  });
  const publicClient = createPublicClient({ chain: arcTestnet, transport });

  const submitHash = await wallet.writeContract({
    address: escrow,
    abi: DEPUTY_ESCROW_ABI,
    functionName: "submitProof",
    args: [BigInt(onChainTaskId), proofHash],
  });
  await publicClient.waitForTransactionReceipt({ hash: submitHash });

  const releaseHash = await wallet.writeContract({
    address: escrow,
    abi: DEPUTY_ESCROW_ABI,
    functionName: "releaseOnProof",
    args: [BigInt(onChainTaskId)],
  });
  await publicClient.waitForTransactionReceipt({ hash: releaseHash });

  return releaseHash;
}

export function isArcSettlementEnabled(): boolean {
  return Boolean(
    DEPUTY_ESCROW_ADDRESS && process.env.DEPUTY_ORACLE_PRIVATE_KEY
  );
}
