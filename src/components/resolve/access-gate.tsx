"use client";

import clsx from "clsx";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { RESOLVE_AGENT_ESCROW_ADDRESS } from "@/lib/arc/config";

export function AccessGateBanner({ className }: { className?: string }) {
  const { ready, message } = useResolveAccess();

  if (ready || !message) return null;

  return (
    <div
      className={clsx(
        "rounded-xl border border-deputy-warn/40 bg-deputy-warn/10 px-4 py-3 text-sm text-deputy-warn",
        className
      )}
    >
      {message}
    </div>
  );
}

export function AgentEscrowBadge({ className }: { className?: string }) {
  const short = `${RESOLVE_AGENT_ESCROW_ADDRESS.slice(0, 6)}…${RESOLVE_AGENT_ESCROW_ADDRESS.slice(-4)}`;
  return (
    <p className={clsx("text-xs text-deputy-muted", className)}>
      Agent escrow ·{" "}
      <a
        href={`https://testnet.arcscan.app/address/${RESOLVE_AGENT_ESCROW_ADDRESS}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-deputy-accent underline"
      >
        {short}
      </a>{" "}
      holds locked budgets until proof
    </p>
  );
}
