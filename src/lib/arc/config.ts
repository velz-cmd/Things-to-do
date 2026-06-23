import { defineChain } from "viem";

/// Arc Testnet — native gas token is USDC (18 decimals). See docs.arc.network
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arcscan",
      url: "https://testnet.arcscan.app",
    },
  },
});

export const USDC_ADDRESS =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`) ??
  "0x3600000000000000000000000000000000000000";

export const DEPUTY_ESCROW_ADDRESS = process.env
  .NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS as `0x${string}` | undefined;

/** RESOLVE agent escrow — custodies locked user budgets until proof. */
export const RESOLVE_AGENT_ESCROW_ADDRESS = (process.env
  .NEXT_PUBLIC_RESOLVE_AGENT_ADDRESS ??
  "0xDD81E79E22053a4d7036D6E9DB22Dad591b65511") as `0x${string}`;

/** @deprecated use RESOLVE_AGENT_ESCROW_ADDRESS */
export const RESOLVE_AGENT_ADDRESS = RESOLVE_AGENT_ESCROW_ADDRESS;

export function isEscrowMisconfigured(): boolean {
  if (!DEPUTY_ESCROW_ADDRESS) return false;
  return (
    DEPUTY_ESCROW_ADDRESS.toLowerCase() ===
    RESOLVE_AGENT_ESCROW_ADDRESS.toLowerCase()
  );
}

export const DEPUTY_ESCROW_ABI = [
  {
    type: "event",
    name: "TaskCreated",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "taskRef", type: "bytes32", indexed: false },
      { name: "lockedAmount", type: "uint256", indexed: false },
      { name: "successFee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "createTask",
    inputs: [
      { name: "taskRef", type: "bytes32" },
      { name: "successFee", type: "uint256" },
    ],
    outputs: [{ name: "taskId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "submitProof",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "proofHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "releaseOnProof",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refundUser",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "nextTaskId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTask",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "user", type: "address" },
          { name: "taskRef", type: "bytes32" },
          { name: "lockedAmount", type: "uint256" },
          { name: "successFee", type: "uint256" },
          { name: "proofHash", type: "bytes32" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

export function arcscanTxUrl(hash: string) {
  return `https://testnet.arcscan.app/tx/${hash}`;
}
