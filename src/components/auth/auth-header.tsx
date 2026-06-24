"use client";

import { useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useDisconnect } from "wagmi";
import { Copy, Mail, Wallet } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAddFunds } from "@/components/wallet/add-funds-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { projectId } from "@/lib/reown/config";
import {
  GMAIL_AFTER_AUTH_KEY,
  setLocalNotificationEmail,
} from "@/lib/auth/guest";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function AuthHeader() {
  const { signOut, signInWithGoogle, balance, balanceLoading } = useAuth();
  const account = useResolveAccount();
  const { openSignIn } = useSignInModal();
  const { openAddFunds } = useAddFunds();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationDraft, setNotificationDraft] = useState("");
  const [showEmailCapture, setShowEmailCapture] = useState(false);

  const displayName = account.displayName ?? "Account";
  const walletOnly = account.authMethod === "wallet";
  const hasEmailSession =
    account.authMethod === "email" ||
    account.authMethod === "google" ||
    account.authMethod === "both";
  const appWallet = account.wallets.find((w) => w.type === "app_managed");

  async function handleConnectGmail() {
    setMenuOpen(false);
    if (walletOnly) {
      try {
        sessionStorage.setItem(GMAIL_AFTER_AUTH_KEY, "1");
      } catch {
        /* ignore */
      }
      await signInWithGoogle();
      return;
    }
    window.location.href = "/api/connectors/gmail/authorize";
  }

  async function saveNotificationEmail() {
    const email = notificationDraft.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    setLocalNotificationEmail(email);
    await fetch("/api/account/notification-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    }).catch(() => null);
    toast.success("Notification email saved", {
      description: hasEmailSession ? undefined : "Not verified",
    });
    setShowEmailCapture(false);
    setMenuOpen(false);
  }

  function copyAddress(addr: string) {
    void navigator.clipboard.writeText(addr);
    toast.success("Address copied");
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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-full border border-deputy-border bg-deputy-panel/80 py-1.5 pl-1.5 pr-3 transition hover:border-deputy-accent/40"
      >
        {walletOnly && !hasEmailSession ? (
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
          {walletOnly && !account.email
            ? shortAddress(account.walletAddress ?? displayName)
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
            <Section title="Account">
              {account.email && (
                <p className="truncate px-3 text-sm font-medium text-white">
                  {account.email}
                </p>
              )}
              {walletOnly && account.walletAddress && (
                <p className="px-3 font-mono text-xs text-deputy-muted">
                  Wallet connected · {shortAddress(account.walletAddress)}
                </p>
              )}
              {appWallet && (
                <div className="mx-2 mt-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-deputy-muted">
                    App wallet
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-sky-300">
                    EVM: {shortAddress(appWallet.address)}
                  </p>
                  {account.appWalletPending && (
                    <p className="mt-1 text-[10px] text-amber-300">
                      App wallet setup pending
                    </p>
                  )}
                </div>
              )}
              {!balanceLoading && balance && hasEmailSession && (
                <p className="mt-1 px-3 text-xs text-deputy-accent">
                  ${balance.availableUsd.toFixed(2)} available
                </p>
              )}
            </Section>

            <Section title="Notifications">
              {account.notificationEmail ? (
                <p className="px-3 text-xs text-deputy-muted">
                  {account.notificationEmail}
                  {!account.notificationEmailVerified && (
                    <span className="ml-1 text-amber-400">· Not verified</span>
                  )}
                </p>
              ) : showEmailCapture ? (
                <div className="space-y-2 px-2 pb-2">
                  <input
                    type="email"
                    value={notificationDraft}
                    onChange={(e) => setNotificationDraft(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-deputy-border bg-deputy-bg px-3 py-2 text-xs text-white outline-none focus:border-deputy-accent/50"
                  />
                  <button
                    type="button"
                    onClick={() => void saveNotificationEmail()}
                    className="w-full rounded-lg bg-deputy-accent/20 py-2 text-xs font-medium text-deputy-accent"
                  >
                    Save email
                  </button>
                </div>
              ) : (
                <MenuItem onClick={() => setShowEmailCapture(true)}>
                  Add notification email
                </MenuItem>
              )}
            </Section>

            <Section title="Connectors">
              <ConnectorRow
                label="Gmail"
                connected={account.gmailConnected}
                detail={account.gmailConnected ? "Connected" : "Not connected"}
              />
              <ConnectorRow
                label="Wallet"
                connected={Boolean(account.walletAddress)}
                detail={
                  account.walletAddress
                    ? shortAddress(account.walletAddress)
                    : "Not connected"
                }
              />
            </Section>

            {!account.gmailConnected && (
              <div className="mx-2 mb-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2.5">
                <p className="text-xs text-slate-300">
                  Connect Gmail to receive refund updates, find receipts, and
                  verify confirmations.
                </p>
                <button
                  type="button"
                  onClick={() => void handleConnectGmail()}
                  className="mt-2 w-full rounded-lg bg-sky-500/20 px-3 py-2 text-left text-sm font-medium text-sky-300 transition hover:bg-sky-500/30"
                >
                  Connect Gmail
                </button>
                {walletOnly && (
                  <p className="mt-2 text-[10px] text-slate-500">
                    Google permission is needed so RESOLVE can find receipts and
                    send refund updates.
                  </p>
                )}
              </div>
            )}

            <Section title="Actions">
              {account.walletAddress && (
                <MenuItem onClick={() => copyAddress(account.walletAddress!)}>
                  <Copy className="mr-2 inline h-3.5 w-3.5" />
                  Copy address
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

              {projectId && (
                <MenuItem
                  onClick={() => {
                    open({ view: "Connect" });
                    setMenuOpen(false);
                  }}
                >
                  {account.walletAddress
                    ? "Connect your own wallet"
                    : "Connect crypto wallet"}
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

              {hasEmailSession && (
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

              {walletOnly && !hasEmailSession && (
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
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-deputy-border py-1 last:border-0">
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-deputy-muted">
        {title}
      </p>
      {children}
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
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
      <span className="flex items-center gap-2 text-deputy-muted">
        {label === "Gmail" ? (
          <Mail className="h-3.5 w-3.5" />
        ) : (
          <Wallet className="h-3.5 w-3.5" />
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
