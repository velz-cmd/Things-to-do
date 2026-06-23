"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Wallet, Package } from "lucide-react";
import type { DiscoveryItem } from "@/lib/discover/discovery-service";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { PageHeader } from "@/components/resolve/ui/page-header";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import { StatusChip } from "@/components/resolve/ui/status-chip";
import Link from "next/link";

export default function RadarPage() {
  const router = useRouter();
  const { ready } = useResolveAccess();
  const { openSignIn } = useSignInModal();
  const [subs, setSubs] = useState<DiscoveryItem[]>([]);
  const [refunds, setRefunds] = useState<DiscoveryItem[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletItems, setWalletItems] = useState<DiscoveryItem[]>([]);

  useEffect(() => {
    void (async () => {
      const [s, r] = await Promise.all([
        fetch("/api/discover/subscriptions", { method: "POST" }).then((r) => r.json()),
        fetch("/api/discover/refunds", { method: "POST" }).then((r) => r.json()),
      ]);
      setSubs(s.items ?? []);
      setRefunds(r.items ?? []);
      setMessages([s.message, r.message].filter(Boolean) as string[]);
    })();
  }, []);

  async function assignFromDiscovery(text: string) {
    if (!ready) {
      openSignIn();
      return;
    }
    try {
      const classifyRes = await fetch("/api/tasks/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });
      const { classification } = await classifyRes.json();
      const createRes = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text, classification }),
      });
      const data = await createRes.json();
      if (!createRes.ok) throw new Error(data.error);
      router.push(`/missions/${data.task.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function scanWallet() {
    const res = await fetch("/api/discover/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: walletAddress }),
    });
    const data = await res.json();
    setWalletItems(data.items ?? []);
    if (data.message) setMessages((m) => [...m, data.message]);
  }

  return (
    <div className="resolve-grid-bg mx-auto max-w-3xl space-y-8 px-4 py-8 lg:px-8">
      <PageHeader
        title="Radar"
        subtitle="Find money leaks and claim opportunities."
      />

      <GlassPanel className="flex items-start gap-3 p-4">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
        <div>
          <p className="text-sm font-medium text-white">Connect Gmail to discover</p>
          <p className="mt-1 text-xs text-resolve-muted">
            Subscriptions and refund opportunities require Gmail or manual input.
          </p>
          <Link href="/vault" className="mt-2 inline-block text-xs text-sky-400 hover:underline">
            Connect in Vault →
          </Link>
        </div>
      </GlassPanel>

      {messages.map((msg, i) => (
        <p key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-100">
          {msg}
        </p>
      ))}

      <DiscoverySection title="Subscriptions" items={subs} onAction={(item, action) => assignFromDiscovery(`${action} ${item.company} subscription`)} />
      <DiscoverySection title="Refund opportunities" items={refunds} onAction={(item) => assignFromDiscovery(`Get refund from ${item.company}`)} actionLabel="Claim" />

      <GlassPanel className="p-5">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-sky-400" />
          <h2 className="font-medium">Wallet scan</h2>
        </div>
        <p className="mt-1 text-xs text-resolve-muted">Add wallet address to scan assets and approvals.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x… wallet address"
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-sky-500/40"
          />
          <button type="button" onClick={scanWallet} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400">
            Scan
          </button>
        </div>
        <DiscoveryList items={walletItems} onAction={(item) => assignFromDiscovery(item.label)} />
      </GlassPanel>

      <GlassPanel className="flex items-start gap-3 p-4">
        <Package className="mt-0.5 h-5 w-5 text-sky-400" />
        <p className="text-sm text-resolve-muted">
          Enter a tracking number on <Link href="/start" className="text-sky-400 hover:underline">Start</Link> to check parcel claim options.
        </p>
      </GlassPanel>
    </div>
  );
}

function DiscoverySection({
  title,
  items,
  onAction,
  actionLabel = "Cancel",
}: {
  title: string;
  items: DiscoveryItem[];
  onAction: (item: DiscoveryItem, action: string) => void;
  actionLabel?: string;
}) {
  return (
    <GlassPanel className="p-5">
      <h2 className="font-medium text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-resolve-muted">Connect Gmail to discover items</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-white">
                  {item.label}{" "}
                  {item.isDemo && <StatusChip label="Demo data" variant="demo" />}
                </p>
                <p className="text-xs text-resolve-muted">${item.amountUsd.toFixed(2)}/{item.period}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => onAction(item, actionLabel)} className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-medium text-white">
                  {actionLabel}
                </button>
                <button type="button" onClick={() => onAction(item, "Request refund for")} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-resolve-muted hover:text-white">
                  Refund
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}

function DiscoveryList({ items, onAction }: { items: DiscoveryItem[]; onAction: (item: DiscoveryItem) => void }) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" onClick={() => onAction(item)} className="w-full rounded-xl border border-white/[0.06] px-3 py-2 text-left text-sm hover:bg-white/5">
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
