"use client";

import { ExternalLink } from "lucide-react";
import type { FxSwapHint } from "@/lib/settlement/fx";

export function FxSwapPanel({ hint }: { hint: FxSwapHint | null }) {
  if (!hint) return null;

  return (
    <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-4 text-sm">
      <p className="font-medium text-sky-100">Optional currency swap</p>
      <p className="mt-1 text-resolve-muted">{hint.message}</p>
      <p className="mt-2 text-xs text-white/80">
        Received ${hint.amountUsd.toFixed(2)} USDC on Arc — swap to {hint.toCurrency} in your wallet.
      </p>
      <a
        href={hint.sampleUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-sky-300 hover:underline"
      >
        Arc stablecoin FX sample (AppKit Swaps)
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
