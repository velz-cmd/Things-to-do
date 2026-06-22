"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import clsx from "clsx";

export function WalletConnect({ compact }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className={clsx(
          "rounded-full border border-deputy-border bg-deputy-panel font-mono text-xs text-deputy-muted transition hover:border-deputy-accent/40",
          compact ? "px-2.5 py-1" : "px-3 py-1.5"
        )}
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  const connector = connectors[0];
  return (
    <button
      type="button"
      disabled={!connector || isPending}
      onClick={() => connector && connect({ connector })}
      className={clsx(
        "rounded-full border border-deputy-accent/40 bg-deputy-accent/10 text-deputy-accent transition hover:bg-deputy-accent/20 disabled:opacity-50",
        compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
      )}
    >
      {isPending ? "Connecting…" : "Connect Arc wallet"}
    </button>
  );
}
