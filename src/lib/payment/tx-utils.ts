import { explorerUrlForTx as publicExplorerUrlForTx } from "@/lib/payment/explorer-public";

/** True only for real Arc/Ethereum transaction hashes */
export function isOnChainTxHash(hash?: string | null): boolean {
  return Boolean(hash?.match(/^0x[a-fA-F0-9]{64}$/));
}

export function explorerUrlForTx(hash?: string | null): string | null {
  return publicExplorerUrlForTx(hash);
}
