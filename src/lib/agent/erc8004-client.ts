import { keccak256, toHex } from "viem";
import {
  ARC_AGENT_OWNER_WALLET_ADDRESS,
  ARC_AGENT_VALIDATOR_WALLET_ADDRESS,
  ERC8004_IDENTITY_REGISTRY,
  ERC8004_REPUTATION_REGISTRY,
  RESOLVE_AGENT_METADATA_URI,
  canRegisterAgent,
} from "@/lib/agent/erc8004-config";
import { ARC_RPC_URL } from "@/lib/settlement/arc-config";
import { executeCircleContractOn } from "@/lib/settlement/circle-client";
import { arcFeatureFlags } from "@/lib/arc/feature-flags";
import { hasCircleCredentials } from "@/lib/settlement/arc-config";
import { prisma } from "@/lib/db";

const IDENTITY_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export async function getResolveAgentRecord() {
  return prisma.resolveAgent.upsert({
    where: { id: "resolve" },
    create: { id: "resolve", metadataUri: RESOLVE_AGENT_METADATA_URI },
    update: {},
  });
}

export async function ensureResolveAgentRegistered(): Promise<{
  agentTokenId: string | null;
  registerTxHash: string | null;
  mode: "live" | "mock";
}> {
  const existing = await getResolveAgentRecord();
  if (!arcFeatureFlags.erc8004) {
    return {
      agentTokenId: existing.agentTokenId,
      registerTxHash: existing.registerTxHash,
      mode: "mock",
    };
  }
  if (existing.agentTokenId) {
    return {
      agentTokenId: existing.agentTokenId,
      registerTxHash: existing.registerTxHash,
      mode: hasCircleCredentials() && canRegisterAgent() ? "live" : "mock",
    };
  }

  if (!hasCircleCredentials() || !canRegisterAgent() || !ARC_AGENT_OWNER_WALLET_ADDRESS) {
    return { agentTokenId: null, registerTxHash: null, mode: "mock" };
  }

  const registerTxHash = await executeCircleContractOn({
    walletAddress: ARC_AGENT_OWNER_WALLET_ADDRESS,
    contractAddress: ERC8004_IDENTITY_REGISTRY,
    abiFunctionSignature: "register(string)",
    abiParameters: [existing.metadataUri],
    label: "register RESOLVE agent",
  });

  const agentTokenId = await readAgentTokenIdFromTx(registerTxHash);

  await prisma.resolveAgent.update({
    where: { id: "resolve" },
    data: { agentTokenId, registerTxHash },
  });

  return { agentTokenId, registerTxHash, mode: "live" };
}

async function readAgentTokenIdFromTx(txHash: string): Promise<string> {
  const { createPublicClient, http } = await import("viem");
  const { arcTestnet } = await import("@/lib/arc/config");

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });

  const receipt = await publicClient.getTransactionReceipt({
    hash: txHash as `0x${string}`,
  });

  for (const log of receipt.logs) {
    if (
      log.address.toLowerCase() === ERC8004_IDENTITY_REGISTRY.toLowerCase() &&
      log.topics[0]?.toLowerCase() === IDENTITY_TRANSFER_TOPIC &&
      log.topics[3]
    ) {
      return BigInt(log.topics[3]).toString();
    }
  }

  throw new Error("Could not read agent token ID from registration tx");
}

export async function recordMissionReputation(input: {
  taskId: string;
  taskTitle: string;
  proofHash: string;
  recoveredUsd: number;
}): Promise<{ txHash: string | null; score: number; mode: "live" | "mock" }> {
  if (!arcFeatureFlags.erc8004) {
    return { txHash: null, score: 0, mode: "mock" };
  }
  const agent = await ensureResolveAgentRegistered();
  if (!agent.agentTokenId) {
    return { txHash: null, score: 0, mode: "mock" };
  }

  const score = Math.min(
    100,
    Math.max(60, Math.round(70 + Math.min(input.recoveredUsd, 100) * 0.3))
  );
  const tag = "verified_outcome";
  const feedbackHash = keccak256(toHex(`${tag}:${input.taskId}:${input.proofHash}`));

  if (
    !hasCircleCredentials() ||
    !ARC_AGENT_VALIDATOR_WALLET_ADDRESS ||
    !canRegisterAgent()
  ) {
    return { txHash: null, score: 0, mode: "mock" };
  }

  const txHash = await executeCircleContractOn({
    walletAddress: ARC_AGENT_VALIDATOR_WALLET_ADDRESS,
    contractAddress: ERC8004_REPUTATION_REGISTRY,
    abiFunctionSignature:
      "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
    abiParameters: [
      agent.agentTokenId,
      score.toString(),
      "0",
      tag,
      input.taskTitle.slice(0, 64),
      "",
      "",
      feedbackHash,
    ],
    label: "record agent reputation",
  });

  await prisma.resolveAgent.update({
    where: { id: "resolve" },
    data: {
      reputationCount: { increment: 1 },
      lastReputationTxHash: txHash,
      lastReputationScore: score,
    },
  });

  return { txHash, score, mode: "live" };
}
