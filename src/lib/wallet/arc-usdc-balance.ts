import { arcTestnet } from "viem/chains";
import { arcRpcAttempt } from "@/lib/arc/rpc-router";
import { ARC_CHAIN_ID, ARC_USDC_CONTRACT } from "@/lib/settlement/arc-config";
import { isArcAlchemyConfigured } from "@/lib/wallet/arc-rpc-url";
import {
  microUsdcToString,
  reconcileArcUsdcInterfaces,
} from "@/lib/arc/usdc-units";

export {
  erc20UnitsToMicroUsdc,
  microUsdcToString,
  nativeWeiToMicroUsdc,
  reconcileArcUsdcInterfaces,
} from "@/lib/arc/usdc-units";

export type ArcBalanceRead = {
  walletAddress: `0x${string}`;
  chainId: 5042002;
  amountMicroUsdc: bigint;
  source: "native_rpc" | "erc20_rpc" | "circle_api" | "database_snapshot" | "browser_snapshot";
  freshness: "live" | "recent" | "stale" | "unknown";
  provider?: string;
  blockNumber?: bigint;
  readAt: string;
  diagnostic?: {
    nativeMicroUsdc?: bigint;
    erc20MicroUsdc?: bigint;
    mismatch?: boolean;
  };
};

/** JSON-safe compatibility shape used by existing Capital routes. */
export type ArcUsdcBalance = {
  address: string;
  chainId: typeof ARC_CHAIN_ID;
  amountMicroUsdc: string;
  nativeUsdc: string;
  erc20Usdc: string;
  totalUsdc: string;
  blockNumber: number;
  provider?: string;
  diagnostic?: { mismatch: boolean };
  source: "arc_rpc";
  syncedAt: string;
};

export class ArcRpcUnavailableError extends Error {
  code = "ARC_RPC_UNAVAILABLE" as const;
  constructor(message = "Could not sync Arc balance. Try again.") {
    super(message);
    this.name = "ArcRpcUnavailableError";
  }
}

function normalizeAddress(address: string): `0x${string}` {
  const normalized = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new ArcRpcUnavailableError("Invalid wallet address");
  }
  return normalized as `0x${string}`;
}

function balanceOfCallData(address: `0x${string}`): `0x${string}` {
  return `0x70a08231${address.slice(2).padStart(64, "0")}` as `0x${string}`;
}

async function readBalance(address: `0x${string}`): Promise<ArcBalanceRead> {
  if (arcTestnet.id !== ARC_CHAIN_ID) {
    throw new ArcRpcUnavailableError("Arc chain configuration mismatch");
  }

  const native = await arcRpcAttempt<string>({
    method: "eth_getBalance",
    params: [address, "latest"],
  });

  // ERC-20 is a diagnostic/fallback interface for the same USDC balance, never an addend.
  const erc20 = await arcRpcAttempt<string>({
    method: "eth_call",
    params: [{ to: ARC_USDC_CONTRACT, data: balanceOfCallData(address) }, "latest"],
  });

  const reconciled = reconcileArcUsdcInterfaces({
    nativeWei: native.ok ? BigInt(native.data) : undefined,
    erc20Units: erc20.ok ? BigInt(erc20.data) : undefined,
  });

  const block = await arcRpcAttempt<string>({ method: "eth_blockNumber", verifyChain: false });
  return {
    walletAddress: address,
    chainId: ARC_CHAIN_ID as 5042002,
    amountMicroUsdc: reconciled.amountMicroUsdc,
    source: reconciled.source,
    freshness: "live",
    provider: native.ok ? native.provider : erc20.ok ? erc20.provider : undefined,
    blockNumber: block.ok ? BigInt(block.data) : undefined,
    readAt: new Date().toISOString(),
    diagnostic: {
      nativeMicroUsdc: reconciled.nativeMicroUsdc,
      erc20MicroUsdc: reconciled.erc20MicroUsdc,
      mismatch: reconciled.mismatch,
    },
  };
}

export async function getArcUsdcBalance(address: string): Promise<ArcUsdcBalance> {
  const normalized = normalizeAddress(address);
  const balance = await readBalance(normalized);
  const native = balance.diagnostic?.nativeMicroUsdc;
  const erc20 = balance.diagnostic?.erc20MicroUsdc;

  return {
    address: normalized,
    chainId: balance.chainId,
    amountMicroUsdc: balance.amountMicroUsdc.toString(),
    nativeUsdc: native === undefined ? "0.00" : microUsdcToString(native),
    erc20Usdc: erc20 === undefined ? "0.00" : microUsdcToString(erc20),
    totalUsdc: microUsdcToString(balance.amountMicroUsdc),
    blockNumber: Number(balance.blockNumber ?? 0n),
    provider: balance.provider,
    diagnostic: { mismatch: Boolean(balance.diagnostic?.mismatch) },
    source: "arc_rpc",
    syncedAt: balance.readAt,
  };
}

export function isAlchemyConfigured(): boolean {
  return isArcAlchemyConfigured();
}

export async function getArcTransactionCount(address: string): Promise<number> {
  const normalized = normalizeAddress(address);
  const result = await arcRpcAttempt<string>({
    method: "eth_getTransactionCount",
    params: [normalized, "latest"],
  });
  return result.ok ? Number(BigInt(result.data)) : 0;
}
