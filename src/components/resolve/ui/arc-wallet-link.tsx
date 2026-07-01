"use client";

import { ExternalLink } from "lucide-react";
import { explorerUrlForAddress } from "@/lib/payment/explorer-public";

function shortAddress(address: string): string {
  const a = address.trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Link to a RESOLVE wallet on Arcscan testnet. */
export function ArcWalletLink({
  address,
  className,
  label,
}: {
  address: string;
  className?: string;
  label?: string;
}) {
  const href = explorerUrlForAddress(address);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`View wallet ${address} on Arcscan`}
      className={
        className ??
        "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-sky-300 hover:border-sky-500/30 hover:text-sky-200"
      }
    >
      <ExternalLink className="h-3 w-3 shrink-0" />
      {label ?? shortAddress(address)}
    </a>
  );
}
