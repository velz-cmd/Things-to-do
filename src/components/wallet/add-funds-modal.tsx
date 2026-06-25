"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useChainId,
} from "wagmi";
import { useAuth } from "@/components/auth/auth-provider";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { RESOLVE_AGENT_ESCROW_ADDRESS, arcTestnet } from "@/lib/arc/config";
import { usdcToWei } from "@/lib/arc/utils";
import { ensureArcNetwork, isArcChain } from "@/lib/arc/wallet";
import { AgentEscrowBadge } from "@/components/resolve/access-gate";
import { CctpBridgePanel } from "@/components/wallet/cctp-bridge-panel";
import { toast } from "sonner";
import clsx from "clsx";

const CARD_METHODS = [
  { id: "card" as const, label: "Credit card", icon: "💳" },
  { id: "debit" as const, label: "Debit card", icon: "🏦" },
  { id: "paypal" as const, label: "PayPal", icon: "🅿️" },
  { id: "bank" as const, label: "Bank transfer", icon: "↔️" },
];

const AMOUNTS = [25, 50, 100];

type Tab = "simple" | "crypto" | "bridge";

export function AddFundsModal({
  open,
  suggestedUsd,
  onClose,
}: {
  open: boolean;
  suggestedUsd?: number;
  onClose: () => void;
}) {
  const { refreshBalance, user } = useAuth();
  const { cryptoReady } = useResolveAccess();
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [cardOnRamp, setCardOnRamp] = useState(false);
  const [tab, setTab] = useState<Tab>("crypto");
  const [method, setMethod] = useState<(typeof CARD_METHODS)[number]["id"]>("card");
  const [amount, setAmount] = useState(50);
  const [loading, setLoading] = useState(false);

  const { sendTransaction, data: txHash, isPending, error: sendError } =
    useSendTransaction();
  const { isLoading: confirming, isSuccess: txConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (!open) return;
    void fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => {
        const enabled = Boolean(cfg.cardOnRamp);
        setCardOnRamp(enabled);
        setTab(enabled ? "simple" : "crypto");
      })
      .catch(() => setTab("crypto"));
  }, [open]);

  useEffect(() => {
    if (suggestedUsd) setAmount(suggestedUsd);
  }, [suggestedUsd, open]);

  useEffect(() => {
    if (!txConfirmed || !txHash) return;

    async function credit() {
      setLoading(true);
      try {
        const res = await fetch("/api/wallet/deposit/crypto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash, amountUsd: amount }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not confirm deposit");
        toast.success("Crypto deposit confirmed", { description: data.message });
        await refreshBalance();
        onClose();
      } catch (e) {
        toast.error("Deposit confirmation failed", {
          description: e instanceof Error ? e.message : "Try again",
        });
      } finally {
        setLoading(false);
      }
    }

    void credit();
  }, [txConfirmed, txHash, amount, refreshBalance, onClose]);

  useEffect(() => {
    if (!isPending && !confirming) setLoading(false);
  }, [isPending, confirming]);

  if (!open) return null;

  async function handleCardDeposit() {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: amount, method }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.useCrypto) {
          toast.error(data.error, { description: data.message });
          setTab("crypto");
          return;
        }
        throw new Error(data.error ?? "Deposit failed");
      }
      toast.success("Funds added", {
        description: data.message ?? `$${amount} ready for tasks`,
      });
      await refreshBalance();
      onClose();
    } catch (e) {
      toast.error("Could not add funds", {
        description: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCryptoDeposit() {
    if (!cryptoReady || !address) {
      toast.error("Connect your crypto wallet first", {
        description: "Use the account menu → Connect crypto wallet",
      });
      return;
    }

    setLoading(true);
    try {
      await ensureArcNetwork();
      if (!isArcChain(chainId)) {
        await switchChainAsync({ chainId: arcTestnet.id });
      }

      sendTransaction({
        chainId: arcTestnet.id,
        to: RESOLVE_AGENT_ESCROW_ADDRESS,
        value: usdcToWei(amount),
      });
    } catch (e) {
      toast.error("Could not open wallet", {
        description: e instanceof Error ? e.message : "Try again",
      });
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-deputy-border bg-deputy-panel p-6">
        <h2 className="text-lg font-semibold">Add funds</h2>
        <p className="mt-1 text-sm text-deputy-muted">
          {tab === "simple"
            ? "Demo instant credit — not a real Circle on-ramp."
            : tab === "bridge"
              ? "Bridge USDC from another chain via CCTP."
              : "Send USDC on Arc Testnet from your connected wallet."}
        </p>

        <div className="mt-4 flex gap-1 rounded-lg bg-black/30 p-1">
          {cardOnRamp && (
            <TabButton active={tab === "simple"} onClick={() => setTab("simple")}>
              Card (demo)
            </TabButton>
          )}
          <TabButton active={tab === "bridge"} onClick={() => setTab("bridge")}>
            Bridge
          </TabButton>
          <TabButton active={tab === "crypto"} onClick={() => setTab("crypto")}>
            Arc
          </TabButton>
        </div>

        <p className="mt-5 text-xs uppercase tracking-wide text-deputy-muted">
          Amount
        </p>
        <div className="mt-2 flex gap-2">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(a)}
              className={clsx(
                "flex-1 rounded-lg border py-2 text-sm font-medium transition",
                amount === a
                  ? "border-deputy-accent bg-deputy-accent/15 text-deputy-accent"
                  : "border-deputy-border text-deputy-muted hover:border-deputy-accent/30"
              )}
            >
              ${a}
            </button>
          ))}
        </div>

        {tab === "simple" ? (
          <>
            <p className="mt-5 text-xs uppercase tracking-wide text-deputy-muted">
              Payment method
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CARD_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={clsx(
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition",
                    method === m.id
                      ? "border-deputy-accent bg-deputy-accent/10"
                      : "border-deputy-border hover:border-deputy-accent/30"
                  )}
                >
                  <span className="mr-1">{m.icon}</span> {m.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-deputy-muted">
              Demo mode only — credits your in-app balance instantly. Production uses
              Arc USDC deposit (Arc tab).
            </p>
            <button
              type="button"
              disabled={loading || !user}
              onClick={handleCardDeposit}
              className="mt-5 w-full rounded-xl bg-deputy-accent py-3 font-semibold text-deputy-bg disabled:opacity-50"
            >
              {loading ? "Processing…" : `Add $${amount} to balance`}
            </button>
          </>
        ) : tab === "bridge" ? (
          <CctpBridgePanel amount={amount} onSuccess={onClose} />
        ) : (
          <>
            <AgentEscrowBadge className="mt-4" />
            {!cryptoReady && (
              <p className="mt-3 rounded-lg border border-deputy-warn/40 bg-deputy-warn/10 px-3 py-2 text-xs text-deputy-warn">
                Connect your wallet from the account menu, then click below — your
                wallet will open to confirm the transfer.
              </p>
            )}
            <button
              type="button"
              disabled={loading || isPending || confirming || !cryptoReady}
              onClick={handleCryptoDeposit}
              className="mt-5 w-full rounded-xl bg-deputy-accent py-3 font-semibold text-deputy-bg disabled:opacity-50"
            >
              {isPending || confirming
                ? "Confirm in wallet…"
                : `Send $${amount} USDC on Arc`}
            </button>
            {sendError && (
              <p className="mt-2 text-xs text-deputy-danger">{sendError.message}</p>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          disabled={loading || isPending || confirming}
          className="mt-3 w-full text-center text-xs text-deputy-muted underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex-1 rounded-md py-2 text-xs font-medium transition",
        active
          ? "bg-deputy-accent/20 text-deputy-accent"
          : "text-deputy-muted hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
