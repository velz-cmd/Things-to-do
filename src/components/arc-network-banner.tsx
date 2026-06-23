"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { arcTestnet } from "@/lib/arc/config";
import { ensureArcNetwork, isArcChain } from "@/lib/arc/wallet";

export function ArcNetworkBanner() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending } = useSwitchChain();

  if (!isConnected || isArcChain(chainId)) return null;

  async function switchToArc() {
    try {
      await ensureArcNetwork();
      await switchChainAsync({ chainId: arcTestnet.id });
    } catch {
      await ensureArcNetwork();
    }
  }

  return (
    <div className="rounded-xl border border-deputy-warn/40 bg-deputy-warn/10 px-4 py-3 text-sm">
      <p className="font-medium text-deputy-warn">Wrong network detected</p>
        <p className="mt-1 text-deputy-muted">
          Escrow locks <strong className="text-white">USDC on Arc Testnet</strong> (chain
          5042002). MetaMask may show &quot;ETH&quot; — on Arc, gas is denominated in USDC.
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={switchToArc}
          className="mt-3 rounded-lg bg-deputy-accent px-3 py-1.5 text-xs font-semibold text-deputy-bg disabled:opacity-50"
        >
          {isPending ? "Switching…" : "Switch to Arc Testnet"}
        </button>
    </div>
  );
}
