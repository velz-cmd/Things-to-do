"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CommandInput } from "@/components/resolve/command-input";
import type { DiscoveryItem } from "@/lib/discover/discovery-service";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { useSignInModal } from "@/components/auth/sign-in-context";

export default function DiscoverPage() {
  const router = useRouter();
  const { ready } = useResolveAccess();
  const { openSignIn } = useSignInModal();
  const [subs, setSubs] = useState<DiscoveryItem[]>([]);
  const [refunds, setRefunds] = useState<DiscoveryItem[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletItems, setWalletItems] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
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
    } finally {
      setLoading(false);
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
    <div className="mx-auto max-w-3xl space-y-8 p-4 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Discover</h1>
        <p className="mt-1 text-sm text-deputy-muted">
          Find subscriptions, refund opportunities, and wallet risks
        </p>
      </header>

      {messages.map((msg, i) => (
        <p key={i} className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {msg}
        </p>
      ))}

      <DiscoverySection
        title="Subscriptions"
        items={subs}
        onAction={(item, action) =>
          assignFromDiscovery(`${action} ${item.company} subscription`)
        }
      />

      <DiscoverySection
        title="Refund opportunities"
        items={refunds}
        onAction={(item) =>
          assignFromDiscovery(`Get refund from ${item.company} — ${item.label}`)
        }
        actionLabel="Claim"
      />

      <section className="rounded-xl border border-deputy-border bg-deputy-panel p-4">
        <h2 className="font-medium">Wallet scan</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x… wallet address"
            className="flex-1 rounded-lg border border-deputy-border bg-deputy-bg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={scanWallet}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
          >
            Scan
          </button>
        </div>
        <DiscoveryList items={walletItems} onAction={(item) => assignFromDiscovery(item.label)} />
      </section>

      <CommandInput
        loading={loading}
        signedIn={ready}
        onSignInRequired={openSignIn}
        onSubmit={assignFromDiscovery}
      />
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
    <section className="rounded-xl border border-deputy-border bg-deputy-panel p-4">
      <h2 className="font-medium">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-deputy-muted">Connect Gmail to discover items</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-deputy-border/60 bg-deputy-bg/40 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">
                  {item.label}{" "}
                  {item.isDemo && (
                    <span className="text-[10px] uppercase text-amber-400">Demo data</span>
                  )}
                </p>
                <p className="text-xs text-deputy-muted">
                  ${item.amountUsd.toFixed(2)}/{item.period}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onAction(item, actionLabel)}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-xs text-white"
                >
                  {actionLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onAction(item, "Request refund for")}
                  className="rounded-lg border border-deputy-border px-3 py-1 text-xs"
                >
                  Refund
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DiscoveryList({
  items,
  onAction,
}: {
  items: DiscoveryItem[];
  onAction: (item: DiscoveryItem) => void;
}) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onAction(item)}
            className="w-full rounded-lg border border-deputy-border px-3 py-2 text-left text-sm hover:bg-deputy-bg/50"
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
