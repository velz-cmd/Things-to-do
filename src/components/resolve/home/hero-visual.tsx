"use client";

import { Mail, Globe, Wallet, Shield, FileCheck, CircleDollarSign } from "lucide-react";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import { StatusChip } from "@/components/resolve/ui/status-chip";

const NODES = [
  { icon: Mail, label: "Gmail", x: "8%", y: "22%", connected: true },
  { icon: Globe, label: "Browser", x: "82%", y: "18%", connected: true },
  { icon: Wallet, label: "Wallet", x: "88%", y: "58%", connected: false },
  { icon: FileCheck, label: "Proof", x: "12%", y: "72%", connected: true },
  { icon: CircleDollarSign, label: "Settle", x: "50%", y: "88%", connected: true },
];

export function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-lg">
      <div className="absolute inset-0 rounded-full bg-sky-500/10 blur-[80px]" />
      <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/20 blur-2xl animate-pulse-slow" />

      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/10 shadow-[0_0_40px_rgba(56,189,248,0.35)]">
          <div className="absolute inset-2 rounded-full border border-white/10" />
          <Shield className="h-10 w-10 text-sky-300" />
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgba(56,189,248,0.15)"
              strokeWidth="2"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="url(#progressGrad)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="289"
              strokeDashoffset="72"
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {NODES.map((node) => {
        const Icon = node.icon;
        return (
          <div
            key={node.label}
            className="absolute z-20 flex flex-col items-center gap-1"
            style={{ left: node.x, top: node.y }}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border backdrop-blur-md ${
                node.connected
                  ? "border-sky-400/30 bg-sky-500/10"
                  : "border-white/10 bg-white/5 opacity-60"
              }`}
            >
              <Icon className="h-4 w-4 text-sky-300" />
            </div>
            <span className="text-[10px] text-resolve-muted">{node.label}</span>
          </div>
        );
      })}

      <GlassPanel className="absolute bottom-0 left-0 right-0 z-30 p-4" glow>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-resolve-muted">Program flow</p>
            <p className="mt-0.5 text-sm font-medium">User-centric royalties</p>
          </div>
          <StatusChip label="Arc settlement" variant="verified" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
          <div>
            <p className="text-resolve-muted">Recognized</p>
            <p className="font-semibold text-white">Plays</p>
          </div>
          <div>
            <p className="text-resolve-muted">Attributed</p>
            <p className="font-semibold text-white">MusicBrainz</p>
          </div>
          <div>
            <p className="text-resolve-muted">Settled</p>
            <p className="font-semibold text-emerald-300">USDC</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-resolve-muted">
          Connect ListenBrainz or Navidrome — RESOLVE routes value to credited artists.
        </p>
      </GlassPanel>
    </div>
  );
}
