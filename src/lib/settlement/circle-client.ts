import { randomUUID } from "crypto";
import {
  ARC_AGENTIC_COMMERCE_CONTRACT,
  ARC_CLIENT_WALLET_ADDRESS,
  ARC_PROVIDER_WALLET_ADDRESS,
  ARC_USDC_CONTRACT,
} from "@/lib/settlement/arc-config";
import { getCircleEntitySecret } from "@/lib/wallet/circle-config";
import { ERC8183_ABI, ERC20_APPROVE_ABI } from "@/lib/settlement/erc8183-abi";
import { verifyArcTx } from "@/lib/settlement/arc-verify";
import { usdcToWei } from "@/lib/arc/utils";

type CircleClient = ReturnType<
  typeof import("@circle-fin/developer-controlled-wallets").initiateDeveloperControlledWalletsClient
>;

let clientPromise: Promise<CircleClient | null> | null = null;
let clientSecretKey: string | null = null;

export function resetCircleClientCache(): void {
  clientPromise = null;
  clientSecretKey = null;
}

/** Build Circle client with an explicit entity secret (bypasses stale env). */
export async function getCircleClientWithSecret(
  entitySecret: string,
): Promise<CircleClient | null> {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  if (!apiKey || !entitySecret) return null;

  const { initiateDeveloperControlledWalletsClient } = await import(
    "@circle-fin/developer-controlled-wallets"
  );
  return initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
}

export async function getCircleClient(): Promise<CircleClient | null> {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  const entitySecret = await getCircleEntitySecret();
  if (!apiKey || !entitySecret) return null;

  if (clientSecretKey !== entitySecret) {
    clientPromise = null;
    clientSecretKey = entitySecret;
  }

  if (!clientPromise) {
    clientPromise = (async () => {
      const { initiateDeveloperControlledWalletsClient } = await import(
        "@circle-fin/developer-controlled-wallets"
      );
      return initiateDeveloperControlledWalletsClient({
        apiKey,
        entitySecret,
      });
    })();
  }
  return clientPromise;
}

async function waitForCircleTx(
  circle: CircleClient,
  transactionId: string,
  label: string
): Promise<string> {
  const maxAttempts = 40;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await circle.getTransaction({ id: transactionId });
    const state = res.data?.transaction?.state;
    const txHash = res.data?.transaction?.txHash;

    if (state === "COMPLETE" && txHash) {
      const verified = await verifyArcTx(txHash);
      if (verified.found && verified.success) return txHash;
      if (verified.found && !verified.success) {
        throw new Error(`${label} failed on Arc`);
      }
    }

    if (state === "FAILED" || state === "DENIED" || state === "CANCELLED") {
      throw new Error(`${label} failed in Circle: ${state}`);
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  throw new Error(`${label} timed out waiting for Circle confirmation`);
}

export async function executeCircleContract(input: {
  walletAddress: string;
  contractAddress?: `0x${string}`;
  abiFunctionSignature: string;
  abiParameters: string[];
  label: string;
}): Promise<string> {
  const contractAddress =
    input.contractAddress ??
    (input.abiFunctionSignature.startsWith("approve")
      ? ARC_USDC_CONTRACT
      : ARC_AGENTIC_COMMERCE_CONTRACT);

  return executeCircleContractOn({
    walletAddress: input.walletAddress,
    contractAddress,
    abiFunctionSignature: input.abiFunctionSignature,
    abiParameters: input.abiParameters,
    label: input.label,
  });
}

export async function executeCircleContractOn(input: {
  walletAddress: string;
  contractAddress: `0x${string}`;
  abiFunctionSignature: string;
  abiParameters: string[];
  label: string;
}): Promise<string> {
  const circle = await getCircleClient();
  if (!circle) {
    throw new Error("Circle client not configured");
  }

  const res = await circle.createContractExecutionTransaction({
    idempotencyKey: randomUUID(),
    walletAddress: input.walletAddress,
    blockchain: "ARC-TESTNET",
    contractAddress: input.contractAddress,
    abiFunctionSignature: input.abiFunctionSignature,
    abiParameters: input.abiParameters,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  const txId = res.data?.id;
  if (!txId) throw new Error(`Circle did not return transaction id for ${input.label}`);

  return waitForCircleTx(circle, txId, input.label);
}

export async function createErc8183Escrow(input: {
  jobDescription: string;
  budgetUsd: number;
}): Promise<{
  jobId: string;
  createJobTxHash: string;
  approveTxHash: string;
  fundTxHash: string;
  setBudgetTxHash?: string;
}> {
  if (!ARC_CLIENT_WALLET_ADDRESS || !ARC_PROVIDER_WALLET_ADDRESS) {
    throw new Error("Arc wallet addresses not configured");
  }

  const expiredAt = Math.floor(Date.now() / 1000) + 86400;
  const amountWei = usdcToWei(input.budgetUsd).toString();

  const createJobTxHash = await executeCircleContract({
    walletAddress: ARC_CLIENT_WALLET_ADDRESS,
    abiFunctionSignature: "createJob(address,address,uint256,string,address)",
    abiParameters: [
      ARC_PROVIDER_WALLET_ADDRESS,
      ARC_PROVIDER_WALLET_ADDRESS,
      expiredAt.toString(),
      input.jobDescription,
      "0x0000000000000000000000000000000000000000",
    ],
    label: "createJob",
  });

  const { createPublicClient, http, decodeEventLog } = await import("viem");
  const { arcTestnet } = await import("@/lib/arc/config");
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const receipt = await publicClient.getTransactionReceipt({
    hash: createJobTxHash as `0x${string}`,
  });

  let jobId: string | null = null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: ERC8183_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "JobCreated") {
        jobId = String((decoded.args as { jobId: bigint }).jobId);
        break;
      }
    } catch {
      /* skip */
    }
  }

  if (!jobId) throw new Error("Could not read JobCreated from createJob receipt");

  await executeCircleContract({
    walletAddress: ARC_CLIENT_WALLET_ADDRESS,
    abiFunctionSignature: "setBudget(uint256,uint256,bytes)",
    abiParameters: [jobId, amountWei, "0x"],
    label: "setBudget",
  });

  const approveTxHash = await executeCircleContract({
    walletAddress: ARC_CLIENT_WALLET_ADDRESS,
    abiFunctionSignature: "approve(address,uint256)",
    abiParameters: [ARC_AGENTIC_COMMERCE_CONTRACT, amountWei],
    label: "approve USDC",
  });

  const fundTxHash = await executeCircleContract({
    walletAddress: ARC_CLIENT_WALLET_ADDRESS,
    abiFunctionSignature: "fund(uint256,bytes)",
    abiParameters: [jobId, "0x"],
    label: "fund escrow",
  });

  return { jobId, createJobTxHash, approveTxHash, fundTxHash };
}

export async function submitErc8183Proof(jobId: string, proofHash: string) {
  if (!ARC_PROVIDER_WALLET_ADDRESS) {
    throw new Error("Provider wallet not configured");
  }

  return executeCircleContract({
    walletAddress: ARC_PROVIDER_WALLET_ADDRESS,
    abiFunctionSignature: "submit(uint256,bytes32,bytes)",
    abiParameters: [jobId, proofHash, "0x"],
    label: "submit proof",
  });
}

export async function completeErc8183Job(jobId: string, reasonHash: string) {
  if (!ARC_CLIENT_WALLET_ADDRESS) {
    throw new Error("Client wallet not configured");
  }

  return executeCircleContract({
    walletAddress: ARC_CLIENT_WALLET_ADDRESS,
    abiFunctionSignature: "complete(uint256,bytes32,bytes)",
    abiParameters: [jobId, reasonHash, "0x"],
    label: "complete job",
  });
}

export async function refundErc8183Job(jobId: string) {
  if (!ARC_CLIENT_WALLET_ADDRESS) {
    throw new Error("Client wallet not configured");
  }

  return executeCircleContract({
    walletAddress: ARC_CLIENT_WALLET_ADDRESS,
    abiFunctionSignature: "claimRefund(uint256)",
    abiParameters: [jobId],
    label: "claim refund",
  });
}
