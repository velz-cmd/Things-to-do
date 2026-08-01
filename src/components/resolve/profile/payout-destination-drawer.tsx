"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { Check, Copy, LoaderCircle, ShieldCheck, WalletCards, X } from "lucide-react";
import type { ProfileBootstrap, ProfileWalletSummary } from "@/lib/profile/control-plane-bootstrap";
import { useProfileBootstrapQuery } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { buildPayoutOwnershipMessage } from "@/lib/profile/payout-ownership-proof";
import { dispatchPayoutDestinationChanged } from "@/lib/profile/payout-events";
import { dispatchProfileRefresh } from "@/lib/profile/refresh-events";

export type PayoutWalletType = "app" | "external";

type Props = {
  open: boolean;
  onClose: () => void;
  initialData?: ProfileBootstrap | null;
  initialWalletType?: PayoutWalletType | null;
  origin?: "profile" | "discover" | "earn";
  onChanged?: (message: string) => void;
};

function short(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function WalletOption({
  wallet,
  type,
  selected,
  current,
  onSelect,
}: {
  wallet: ProfileWalletSummary;
  type: PayoutWalletType;
  selected: boolean;
  current: boolean;
  onSelect: () => void;
}) {
  const app = type === "app";
  return (
    <button
      type="button"
      data-action-id="profile.set_payout_destination"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl border p-4 text-left transition ${selected ? "border-violet-300/50 bg-violet-400/10" : "border-white/10 bg-[#07111f] hover:border-white/20"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{app ? "RESOLVE wallet" : "Connected wallet"}</p>
          <p className="mt-1 text-xs text-slate-400">{app ? "Application managed" : "User signed"}</p>
        </div>
        {current ? <span className="rounded-full border border-emerald-300/20 px-2 py-1 text-[10px] text-emerald-300">Current payout</span> : null}
      </div>
      <p className="mt-3 font-mono text-xs text-slate-300">{short(wallet.address)}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        {app
          ? "Verified earnings will settle to your application-managed Arc wallet."
          : "Verified earnings will settle directly to your connected Arc wallet."}
      </p>
    </button>
  );
}

export function PayoutDestinationDrawer({
  open,
  onClose,
  initialData,
  initialWalletType,
  origin = "profile",
  onChanged,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const account = useAccount();
  const { signMessageAsync } = useSignMessage();
  const query = useProfileBootstrapQuery(open, initialData);
  const data = query.data ?? initialData;
  const [selected, setSelected] = useState<PayoutWalletType | null>(initialWalletType ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(initialWalletType ?? null);
      setError(null);
      setCopied(false);
    }
  }, [initialWalletType, open]);

  const selectedWallet = useMemo(() => {
    if (selected === "app") return data?.wallets.appWallet ?? null;
    if (selected === "external") return data?.wallets.connectedWallet ?? null;
    return null;
  }, [data, selected]);

  if (!open) return null;

  const currentAddress = data?.wallets.payoutDestination?.address.toLowerCase() ?? null;
  const currentLabel = currentAddress
    ? `${data?.wallets.appWallet?.address.toLowerCase() === currentAddress ? "RESOLVE wallet" : "Connected wallet"} ${short(currentAddress)}`
    : "No payout destination selected";
  const appCurrent = Boolean(data?.wallets.appWallet && data.wallets.appWallet.address.toLowerCase() === currentAddress);
  const externalCurrent = Boolean(data?.wallets.connectedWallet && data.wallets.connectedWallet.address.toLowerCase() === currentAddress);

  async function confirmSelection() {
    if (!selected || !selectedWallet) return;
    setBusy(true);
    setError(null);
    try {
      const idempotencyKey = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${selected}-${Date.now()}`;
      let ownershipProof: { message: string; signature: `0x${string}` } | undefined;
      if (selected === "external") {
        if (!account.isConnected || account.address?.toLowerCase() !== selectedWallet.address.toLowerCase()) {
          throw new Error(`Connect ${short(selectedWallet.address)} before verifying it for payouts.`);
        }
        const message = buildPayoutOwnershipMessage(selectedWallet.address, idempotencyKey);
        const signature = await signMessageAsync({ message });
        ownershipProof = { message, signature };
      }
      const response = await fetch("/api/profile/payout-destination", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletType: selected,
          confirm: true,
          idempotencyKey,
          ownershipProof,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; status?: string };
      if (!response.ok) throw new Error(payload.error ?? "Payout destination was not updated");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.profileBootstrap }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profileState }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profileEarnings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.capitalBootstrap }),
        queryClient.invalidateQueries({ queryKey: queryKeys.capitalState }),
      ]);
      await query.refetch();
      dispatchProfileRefresh();
      dispatchPayoutDestinationChanged();
      router.refresh();
      const label = selected === "app" ? "RESOLVE wallet" : "connected wallet";
      const message = payload.status === "verified"
        ? `${label} is now the verified payout destination.`
        : `${label} is selected and pending ownership proof.`;
      onChanged?.(message);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Payout destination update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/65" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="payout-drawer-title" className="h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-[#060d17] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-violet-300">Payout destination</p>
            <h2 id="payout-drawer-title" className="mt-1 text-xl font-semibold text-white">Choose where future earnings settle</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">This changes future verified earnings. Existing submitted payments keep their original recipient address.</p>
          </div>
          <button type="button" aria-label="Close payout selection" disabled={busy} onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        {query.isLoading && !data ? <div className="mt-8 flex items-center gap-2 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Loading canonical wallets</div> : null}
        {data ? (
          <>
            <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#091522] p-4 text-xs">
              <div className="flex items-center gap-2 text-slate-300"><ShieldCheck className="h-4 w-4 text-cyan-300" />Arc Testnet USDC</div>
              <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-2">
                <dt className="text-slate-500">Current destination</dt><dd className="text-slate-200">{currentLabel}</dd>
                <dt className="text-slate-500">Opened from</dt><dd className="capitalize text-slate-200">{origin}</dd>
              </dl>
            </div>
            <div className="mt-4 space-y-3">
              {data.wallets.appWallet ? <WalletOption wallet={data.wallets.appWallet} type="app" selected={selected === "app"} current={appCurrent} onSelect={() => setSelected("app")} /> : null}
              {data.wallets.connectedWallet ? <WalletOption wallet={data.wallets.connectedWallet} type="external" selected={selected === "external"} current={externalCurrent} onSelect={() => setSelected("external")} /> : null}
            </div>
            {selectedWallet ? (
              <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#091522] p-4 text-xs">
                <dl className="grid grid-cols-[130px_1fr] gap-y-2">
                  <dt className="text-slate-500">Wallet type</dt><dd className="text-slate-200">{selected === "app" ? "Application managed" : "Connected external"}</dd>
                  <dt className="text-slate-500">Custody</dt><dd className="text-slate-200">{selected === "app" ? "RESOLVE managed" : "User signed"}</dd>
                  <dt className="text-slate-500">Control state</dt><dd className="text-slate-200">{selected === "app" ? "Verified by wallet inventory" : "Connected, ownership proof required"}</dd>
                  <dt className="text-slate-500">New destination</dt><dd className="break-all font-mono text-slate-200">{selectedWallet.address}</dd>
                  <dt className="text-slate-500">Signature required</dt><dd className="text-slate-200">{selected === "app" ? "No" : "Yes, this confirmation verifies ownership"}</dd>
                </dl>
                <button type="button" onClick={async () => { await navigator.clipboard.writeText(selectedWallet.address); setCopied(true); }} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-slate-300"><Copy className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy full address"}</button>
              </div>
            ) : null}
          </>
        ) : null}
        {error ? <p role="alert" className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2 text-sm text-rose-100">{error}</p> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-lg border border-white/10 px-4 text-sm text-slate-300">Cancel</button>
          <button type="button" data-action-id="profile.set_payout_destination" disabled={!selectedWallet || busy || (selected === "app" ? appCurrent : externalCurrent)} onClick={() => void confirmSelection()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />}
            {selected === "app" ? "Use RESOLVE wallet for payouts" : selected === "external" ? "Use connected wallet for payouts" : "Choose a wallet"}
          </button>
        </div>
        {selected === "app" && appCurrent || selected === "external" && externalCurrent ? <p className="mt-3 flex items-center justify-end gap-1 text-xs text-emerald-300"><Check className="h-3.5 w-3.5" />Already selected</p> : null}
      </section>
    </div>
  );
}
