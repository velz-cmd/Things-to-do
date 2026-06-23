#!/usr/bin/env npx tsx
/**
 * Deploy DeputyEscrow to Arc Testnet
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join } from "path";

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
} as const;

async function main() {
  const pk = process.env.DEPUTY_ORACLE_PRIVATE_KEY;
  if (!pk) throw new Error("DEPUTY_ORACLE_PRIVATE_KEY required");

  const account = privateKeyToAccount(pk as `0x${string}`);
  const bytecode = JSON.parse(
    readFileSync(
      join(__dirname, "../contracts/out/DeputyEscrow.sol/DeputyEscrow.json"),
      "utf8"
    )
  );

  const wallet = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const hash = await wallet.deployContract({
    abi: bytecode.abi,
    bytecode: bytecode.bytecode.object as `0x${string}`,
    args: [account.address],
  });

  console.log("Deploy tx:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Contract address:", receipt.contractAddress);
  console.log("\nAdd to .env:");
  console.log(`NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS=${receipt.contractAddress}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
