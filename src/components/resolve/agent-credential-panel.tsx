"use client";

import { useEffect, useState } from "react";
import { Shield, ExternalLink } from "lucide-react";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import { StatusChip } from "@/components/resolve/ui/status-chip";

type AgentIdentity = {
  name: string;
  description?: string;
  agentTokenId: string | null;
  registerTxHash: string | null;
  registerTxUrl: string | null;
  reputationCount: number;
  lastReputationScore: number | null;
  lastReputationTxHash: string | null;
  mode: "live" | "mock";
  standards: string[];
  liveReady: boolean;
  error?: string;
};

export function AgentCredentialPanel({ compact }: { compact?: boolean }) {
  const [agent, setAgent] = useState<AgentIdentity | null>(null);

  useEffect(() => {
    fetch("/api/agent/identity")
      .then((r) => r.json())
      .then(setAgent)
      .catch(() => null);
  }, []);

  if (!agent) return null;

  return (
    <GlassPanel className={compact ? "p-4" : "p-5"}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10">
            <Shield className="h-5 w-5 text-sky-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{agent.name} agent</p>
            <p className="mt-0.5 text-xs text-resolve-muted">
              {compact
                ? "ERC-8004 onchain identity on Arc"
                : agent.description}
            </p>
          </div>
        </div>
        <StatusChip
          label={agent.mode === "live" ? "Arc verified" : "Demo mode"}
          variant={agent.mode === "live" ? "verified" : "demo"}
        />
      </div>

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <InfoRow
          label="Agent ID"
          value={agent.agentTokenId ? `#${agent.agentTokenId}` : "Pending registration"}
          mono
        />
        <InfoRow
          label="Reputation events"
          value={String(agent.reputationCount)}
        />
        {agent.lastReputationScore != null && (
          <InfoRow label="Last score" value={`${agent.lastReputationScore}/100`} />
        )}
        <InfoRow label="Standards" value={agent.standards.join(" · ")} />
      </div>

      {agent.registerTxUrl && (
        <a
          href={agent.registerTxUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
        >
          View identity registration on Arcscan
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {!agent.liveReady && (
        <p className="mt-3 text-[11px] text-amber-200/80">
          Live ERC-8004 requires Circle credentials and separate owner/validator wallets.
        </p>
      )}
    </GlassPanel>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-resolve-muted">{label}</p>
      <p className={`mt-0.5 text-white ${mono ? "font-mono text-[11px]" : ""}`}>{value}</p>
    </div>
  );
}
