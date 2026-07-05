"use client";

import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { WalletHealth } from "@/lib/capital/wallet-types";
const ARC_EXPLORER_URL = "https://testnet.arcscan.app";

type WalletHealthRowProps = {
  health: WalletHealth;
  onRetry?: () => void;
  retrying?: boolean;
};

function sourceLabel(source: string) {
  switch (source) {
    case "circle_embedded":
      return "Circle RESOLVE wallet";
    case "server_wallet":
      return "RESOLVE wallet";
    case "profile":
      return "Profile wallet";
    case "external_wallet":
      return "Connected wallet";
    default:
      return source;
  }
}

export function WalletHealthRow({ health, onRetry, retrying }: WalletHealthRowProps) {
  const live = health.rpcStatus === "live";
  const syncing = health.rpcStatus === "syncing";

  return (
    <div className="mb-4 rounded-xl border border-white/[0.06] bg-black/25 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
            Wallet health
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                live ?
                  "bg-emerald-500/15 text-emerald-200"
                : syncing ?
                  "bg-sky-500/15 text-sky-200"
                : "bg-amber-500/15 text-amber-200"
              }`}
            >
              {live ?
                <Wifi className="h-3 w-3" />
              : syncing ?
                <RefreshCw className="h-3 w-3 animate-spin" />
              : <WifiOff className="h-3 w-3" />}
              {live ? "Arc RPC live" : syncing ? "Loading Arc wallet…" : "Arc connection failed"}
            </span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-resolve-muted">
              Arc testnet · chain {health.chainId}
            </span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-resolve-muted">
              {sourceLabel(health.source)}
            </span>
          </div>
          <p className="mt-2 font-mono text-[11px] text-white">{health.address}</p>
          {health.externalAddress && (
            <p className="mt-1 text-[10px] text-resolve-muted">
              External: {health.externalAddress.slice(0, 6)}…{health.externalAddress.slice(-4)}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-resolve-muted">
            {health.blockNumber != null && <span>Block {health.blockNumber.toLocaleString()}</span>}
            {health.syncedAt && (
              <span>Synced {new Date(health.syncedAt).toLocaleTimeString()}</span>
            )}
            {health.nativeUsdc != null && health.erc20Usdc != null && (
              <span>
                Native ${health.nativeUsdc} · ERC-20 ${health.erc20Usdc}
              </span>
            )}
            <a
              href={`${ARC_EXPLORER_URL}/address/${health.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-resolve-accent hover:underline"
            >
              View on Arcscan
            </a>
          </div>
        </div>
        {!live && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/[0.06] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
