"use client";

import { ExternalLink } from "lucide-react";
import { explorerUrlForTx } from "@/lib/payment/explorer-public";

/** Small Arcscan proof link — use wherever a settlement tx hash is shown. */
export function ArcTxLink({
  txHash,
  className,
  label = "Arc proof",
}: {
  txHash: string;
  className?: string;
  label?: string;
}) {
  const href = explorerUrlForTx(txHash);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`View ${txHash} on Arcscan`}
      className={
        className ??
        "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-sky-300 hover:border-sky-500/30 hover:text-sky-200"
      }
    >
      <ExternalLink className="h-3 w-3 shrink-0" />
      {label}
    </a>
  );
}
