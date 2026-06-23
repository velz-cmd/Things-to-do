import { arcTestnet } from "@/lib/arc/config";

const ARC_CHAIN_ID_HEX = `0x${arcTestnet.id.toString(16)}`;

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return eth ?? null;
}

/** Add Arc Testnet to MetaMask / injected wallet if missing, then switch. */
export async function ensureArcNetwork(): Promise<void> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error("No wallet found — install MetaMask");

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_ID_HEX }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code !== 4902) throw err;

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: ARC_CHAIN_ID_HEX,
          chainName: arcTestnet.name,
          nativeCurrency: arcTestnet.nativeCurrency,
          rpcUrls: arcTestnet.rpcUrls.default.http,
          blockExplorerUrls: [arcTestnet.blockExplorers.default.url],
        },
      ],
    });
  }
}

export function isArcChain(chainId?: number): boolean {
  return chainId === arcTestnet.id;
}
