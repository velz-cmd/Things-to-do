"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConnectorReadinessPanel } from "@/components/resolve/connector-readiness-panel";
import { BalanceSummary } from "@/components/wallet/balance-summary";
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
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Vault</h1>
        <p className="mt-1 text-sm text-deputy-muted">
          Connectors, preferences, and safe task memory
        </p>
      </header>

      <BalanceSummary />

      <ConnectorReadinessPanel connectors={connectors} />

      <section className="rounded-xl border border-deputy-border bg-deputy-panel p-4 space-y-3">
        <h2 className="font-medium">Connectors</h2>
        <button
          type="button"
          disabled={!ready}
          onClick={connectGmail}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Connect Gmail
        </button>
        <div className="flex gap-2">
          <input
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Wallet address for scan"
            className="flex-1 rounded-lg border border-deputy-border bg-deputy-bg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={saveWallet}
            className="rounded-lg border border-deputy-border px-4 py-2 text-sm"
          >
            Save wallet
          </button>
        </div>
        <p className="text-xs text-deputy-muted">
          RESOLVE does not store passwords, private keys, seed phrases, or full card numbers.
        </p>
      </section>
    </div>
  );
}
