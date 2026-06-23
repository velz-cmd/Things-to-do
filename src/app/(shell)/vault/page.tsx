"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Wallet } from "lucide-react";
import { ConnectorReadinessPanel } from "@/components/resolve/connector-readiness-panel";
import { AgentCredentialPanel } from "@/components/resolve/agent-credential-panel";
import { PageHeader } from "@/components/resolve/ui/page-header";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import type { ConnectorStatus } from "@/lib/connectors/connector-types";
import { useResolveAccess } from "@/hooks/use-resolve-access";

export default function VaultPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [walletAddress, setWalletAddress] = useState("");
  const { ready } = useResolveAccess();

  useEffect(() => {
    fetch("/api/connectors/status")
      .then((r) => r.json())
      .then((d) => setConnectors(d.connectors ?? []));
  }, []);

  async function connectGmail() {
    const res = await fetch("/api/connectors/gmail/connect", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message ?? data.error);
      return;
    }
    toast.success("Gmail connected");
    const c = await fetch("/api/connectors/status").then((r) => r.json());
    setConnectors(c.connectors ?? []);
  }

  async function saveWallet() {
    const res = await fetch("/api/connectors/wallet/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: walletAddress }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
      return;
    }
    toast.success("Wallet saved for scanning");
  }

  return (
    <div className="resolve-grid-bg mx-auto max-w-3xl space-y-6 px-4 py-8 lg:px-8">
      <PageHeader
        title="Vault"
        subtitle="Your safe task memory and connected accounts."
      />

      <ConnectorReadinessPanel connectors={connectors} />

      <AgentCredentialPanel />

      <GlassPanel className="space-y-4 p-5">
        <h2 className="font-medium text-white">Connected accounts</h2>
        <button
          type="button"
          disabled={!ready}
          onClick={connectGmail}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
        >
          <Mail className="h-4 w-4" />
          Connect Gmail
        </button>
        <div className="flex gap-2">
          <input
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Wallet address for scan"
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-sky-500/40"
          />
          <button
            type="button"
            onClick={saveWallet}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
          >
            <Wallet className="h-4 w-4" />
            Save
          </button>
        </div>
        <p className="text-xs text-resolve-muted">
          RESOLVE never stores passwords, private keys, seed phrases, or full card numbers.
        </p>
      </GlassPanel>
    </div>
  );
}
