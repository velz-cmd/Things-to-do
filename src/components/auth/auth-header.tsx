"use client";

import { useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useDisconnect } from "wagmi";
import { Mail, Wallet } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAddFunds } from "@/components/wallet/add-funds-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { projectId } from "@/lib/reown/config";

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
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = account.displayName ?? "Account";
  const walletOnly = account.authMethod === "wallet";

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
            {initials(displayName)}
          </span>
        )}
        <span className="hidden max-w-[120px] truncate text-sm font-medium text-white sm:block">
          {walletOnly && account.walletAddress
            ? shortAddress(account.walletAddress)
            : displayName}
        </span>
        {account.authMethod === "both" && (
          <span
            className="hidden h-2 w-2 rounded-full bg-deputy-accent sm:block"
            title="Wallet connected"
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
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-deputy-border bg-deputy-panel p-2 shadow-xl">
            <div className="border-b border-deputy-border px-3 py-2.5">
              <p className="truncate text-sm font-medium text-white">{displayName}</p>
              {account.email && (
                <p className="truncate text-xs text-deputy-muted">{account.email}</p>
              )}
              {account.walletAddress && (
                <p className="mt-1 font-mono text-[10px] text-deputy-muted">
                  Wallet connected · {shortAddress(account.walletAddress)}
                </p>
              )}
              {!balanceLoading && balance && account.authMethod !== "wallet" && (
                <p className="mt-1 text-xs text-deputy-accent">
                  ${balance.availableUsd.toFixed(2)} available
                </p>
              )}
            </div>

            <ConnectorRow
              label="Account"
              connected={
                account.authMethod === "supabase" || account.authMethod === "both"
              }
              detail={
                account.email ??
                (walletOnly ? "Wallet identity" : undefined)
              }
            />
            <ConnectorRow
              label="Gmail"
              connected={account.gmailConnected}
              detail={account.gmailConnected ? "Connected" : "Not connected"}
            />

            {!account.gmailConnected && (
              <div className="mx-2 mb-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2.5">
                <p className="text-xs text-slate-300">
                  Connect Gmail to receive refund updates, find receipts, and verify
                  confirmations.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (walletOnly) {
                      openSignIn();
                    } else {
                      window.location.href = "/api/connectors/gmail/authorize";
                    }
                    setMenuOpen(false);
                  }}
                  className="mt-2 w-full rounded-lg bg-sky-500/20 px-3 py-2 text-left text-sm font-medium text-sky-300 transition hover:bg-sky-500/30"
                >
                  {walletOnly
                    ? "Sign in to connect Gmail"
                    : "Connect Gmail for updates"}
                </button>
              </div>
            )}

            {account.authMethod !== "wallet" && (
              <MenuItem
                onClick={() => {
                  openAddFunds();
                  setMenuOpen(false);
                }}
              >
                Add funds
              </MenuItem>
            )}

            {projectId && (
              <MenuItem
                onClick={() => {
                  open({ view: "Connect" });
                  setMenuOpen(false);
                }}
              >
                {account.walletAddress ? "Wallet settings" : "Connect crypto wallet"}
              </MenuItem>
            )}

            {account.walletAddress && (
              <MenuItem
                onClick={() => {
                  disconnect();
                  setMenuOpen(false);
                }}
              >
                Disconnect wallet
              </MenuItem>
            )}

            {account.authMethod !== "wallet" && (
              <MenuItem
                onClick={async () => {
                  if (account.walletAddress) disconnect();
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
                onClick={() => {
                  disconnect();
                  setMenuOpen(false);
                }}
                className="text-deputy-warn"
              >
                Disconnect wallet
              </MenuItem>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ConnectorRow({
  label,
  connected,
  detail,
}: {
  label: string;
  connected: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
      <span className="flex items-center gap-2 text-deputy-muted">
        {label === "Gmail" ? (
          <Mail className="h-3.5 w-3.5" />
        ) : (
          <span className="h-3.5 w-3.5 rounded-full border border-deputy-border" />
        )}
        {label}
      </span>
      <span
        className={clsx(
          "rounded-full px-2 py-0.5 text-[10px] font-medium",
          connected
            ? "bg-deputy-accent/10 text-deputy-accent"
            : "bg-white/5 text-deputy-muted"
        )}
      >
        {detail ?? (connected ? "Connected" : "Not connected")}
      </span>
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
