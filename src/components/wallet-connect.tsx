"use client";

import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import clsx from "clsx";
import { arcTestnet } from "@/lib/arc/config";
import { ensureArcNetwork, isArcChain } from "@/lib/arc/wallet";

export function WalletConnect({ compact }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  async function connectArc() {
    const connector = connectors[0];
    if (!connector) return;
    connect(
      { connector, chainId: arcTestnet.id },
      {
        onSuccess: async () => {
          try {
            await ensureArcNetwork();
          } catch {
            /* user may decline network add */
          }
        },
      }
    );
  }

  if (isConnected && address) {
    const onArc = isArcChain(chainId);
    return (
      <div className={compact ? "space-y-1" : "space-y-1.5"}>
        <button
          type="button"
          onClick={() => disconnect()}
          className={clsx(
            "rounded-full border bg-deputy-panel font-mono text-xs transition hover:border-deputy-accent/40",
            onArc
              ? "border-deputy-border text-deputy-muted"
              : "border-deputy-warn/50 text-deputy-warn",
            compact ? "px-2.5 py-1" : "px-3 py-1.5"
          )}
        >
          {address.slice(0, 6)}…{address.slice(-4)}
        </button>
        {!onArc && (
          <p className="text-[10px] text-deputy-warn">Not on Arc — switch network</p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!connectors[0] || isPending}
      onClick={connectArc}
      className={clsx(
        "rounded-full border border-deputy-accent/40 bg-deputy-accent/10 text-deputy-accent transition hover:bg-deputy-accent/20 disabled:opacity-50",
        compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
      )}
    >
      {isPending ? "Connecting…" : "Connect Arc wallet"}
    </button>
  );
}
