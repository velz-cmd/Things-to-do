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

export async function refundEscrowOnArc(
  onChainTaskId: number
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

  const hash = await wallet.writeContract({
    address: escrow,
    abi: DEPUTY_ESCROW_ABI,
    functionName: "refundUser",
    args: [BigInt(onChainTaskId)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
