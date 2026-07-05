"use client";

import { useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useDisconnect } from "wagmi";
import { Copy, Wallet } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAddFunds } from "@/components/wallet/add-funds-context";
import { useSendFunds } from "@/components/wallet/send-funds-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { clearGuestExploring } from "@/lib/auth/guest";
import { ArcWalletLink } from "@/components/resolve/ui/arc-wallet-link";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function AuthHeader() {
  const { signOut, balance, balanceLoading } = useAuth();
  const account = useResolveAccount();
  const { openSignIn } = useSignInModal();
  const { openAddFunds } = useAddFunds();
  const { openSendFunds } = useSendFunds();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const [menuOpen, setMenuOpen] = useState(false);

  const walletOnly = account.mode === "wallet";
  const hasEmailSession = account.accountVerified;
  const hasExternal =
    Boolean(account.externalWalletAddress) &&
    account.externalWalletAddress?.toLowerCase() !==
      account.appWalletAddress?.toLowerCase();

  function copyAddress(addr: string) {
    void navigator.clipboard.writeText(addr);
    toast.success("Address copied");
  }

  function disconnectExternal() {
    disconnect();
    setMenuOpen(false);
    toast.success("External wallet disconnected");
  }

  if (account.mode === "guest") {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="rounded-full border border-deputy-border bg-deputy-panel px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-deputy-accent/50"
        >
          Guest
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-deputy-border bg-deputy-panel p-2 shadow-xl">
              <MenuItem
                onClick={() => {
                  clearGuestExploring();
                  openSignIn();
                  setMenuOpen(false);
                }}
              >
                Sign in
              </MenuItem>
            </div>
          </>
        )}
      </div>
    );
  }

  if (!account.isAuthenticated) {
    return (
      <button
        type="button"
        onClick={openSignIn}
        className="rounded-full border border-deputy-border bg-deputy-panel px-4 py-2 text-sm font-medium text-white transition hover:border-deputy-accent/50 hover:bg-deputy-accent/10"
      >
        Sign in
      </button>
    );
  }

  const chipLabel =
    walletOnly && account.externalWalletAddress
      ? shortAddress(account.externalWalletAddress)
      : account.email
        ? account.email.split("@")[0]
        : (account.displayName ?? "Account");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-full border border-deputy-border bg-deputy-panel/80 py-1.5 pl-1.5 pr-3 transition hover:border-deputy-accent/40"
      >
        {walletOnly ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-deputy-accent/20">
            <Wallet className="h-4 w-4 text-deputy-accent" />
          </span>
        ) : account.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={account.avatarUrl}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-deputy-accent/20 text-xs font-semibold text-deputy-accent">
            {initials(chipLabel)}
          </span>
        )}
        <span className="hidden max-w-[140px] truncate text-sm font-medium text-white sm:block">
          {chipLabel}
        </span>
        {hasExternal && hasEmailSession && (
          <span
            className="hidden h-2 w-2 rounded-full bg-deputy-accent sm:block"
            title="Your wallet connected"
          />
        )}
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-deputy-border bg-deputy-panel p-2 shadow-xl">
            <div className="border-b border-deputy-border px-3 py-3">
              {account.email && (
                <p className="truncate text-sm font-medium text-white">
                  {account.email}
                </p>
              )}
              {account.appWalletAddress && hasEmailSession && (
                <div className="mt-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-deputy-muted">
                    Your RESOLVE wallet
                  </p>
                  {account.walletsLoading || account.appWalletPending ? (
                    <p className="mt-0.5 text-xs text-slate-500">Loading wallet…</p>
                  ) : (
                    <>
                      <p className="mt-0.5 font-mono text-xs text-sky-300">
                        {shortAddress(account.appWalletAddress)}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {account.appWalletProvider === "circle"
                          ? "Circle Arc testnet · one wallet per account · never changes"
                          : "Provisioning Arc wallet…"}
                      </p>
                      <div className="mt-1.5">
                        <ArcWalletLink address={account.appWalletAddress} label="View on Arcscan" />
                      </div>
                    </>
                  )}
                </div>
              )}
              {hasExternal && (
                <p className="mt-2 font-mono text-[10px] text-deputy-muted">
                  Your wallet · {shortAddress(account.externalWalletAddress!)}
                </p>
              )}
              {!balanceLoading && hasEmailSession && balance && (
                <p className="mt-2 text-xs text-deputy-accent">
                  ${balance.availableUsd.toFixed(2)} USDC on Arc testnet
                  {balance.onChainUsd != null &&
                    Math.abs(balance.onChainUsd - balance.availableUsd) > 0.001 && (
                      <span className="text-slate-500">
                        {" "}
                        (${balance.onChainUsd.toFixed(2)} on-chain
                        {balance.availableUsd < balance.onChainUsd ? ", reserves held" : ""})
                      </span>
                    )}
                </p>
              )}
              {!balanceLoading && hasEmailSession && !balance && (
                <p className="mt-2 text-xs text-amber-300/90">
                  Balance will appear after wallet sync. Capital can retry without blocking this page.
                </p>
              )}
              {balanceLoading && hasEmailSession && balance && (
                <p className="mt-2 text-[10px] text-slate-500">
                  Refreshing balance in background
                </p>
              )}
            </div>

            <div className="py-1">
              {account.appWalletAddress && (
                <MenuItem onClick={() => copyAddress(account.appWalletAddress!)}>
                  <Copy className="mr-2 inline h-3.5 w-3.5" />
                  Copy RESOLVE wallet address
                </MenuItem>
              )}

              {hasEmailSession && (
                <MenuItem
                  onClick={() => {
                    openAddFunds();
                    setMenuOpen(false);
                  }}
                >
                  Add funds
                </MenuItem>
              )}

              {hasEmailSession && (balance?.availableUsd ?? 0) > 0 && (
                <MenuItem
                  onClick={() => {
                    openSendFunds();
                    setMenuOpen(false);
                  }}
                >
                  Send USDC
                </MenuItem>
              )}

              {hasEmailSession && (
                <MenuItem
                  onClick={() => {
                    open({ view: "Connect" });
                    setMenuOpen(false);
                  }}
                >
                  <Wallet className="mr-2 inline h-3.5 w-3.5 text-sky-400" />
                  {hasExternal ? "Use a different wallet" : "Use your own wallet"}
                </MenuItem>
              )}

              {hasExternal && (
                <MenuItem onClick={disconnectExternal}>
                  Disconnect your wallet
                </MenuItem>
              )}

              {hasEmailSession && (
                <MenuItem
                  onClick={async () => {
                    if (hasExternal) disconnect();
                    await signOut();
                    setMenuOpen(false);
                  }}
                  className="text-deputy-warn"
                >
                  Sign out
                </MenuItem>
              )}

              {walletOnly && (
                <MenuItem
                  onClick={disconnectExternal}
                  className="text-deputy-warn"
                >
                  Disconnect wallet
                </MenuItem>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-full rounded-lg px-3 py-2 text-left text-sm text-deputy-muted transition hover:bg-deputy-bg hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}
