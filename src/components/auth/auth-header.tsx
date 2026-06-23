"use client";

import { useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useDisconnect } from "wagmi";
import clsx from "clsx";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAddFunds } from "@/components/wallet/add-funds-context";
import { projectId } from "@/lib/reown/config";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function AuthHeader() {
  const { user, signOut, balance, balanceLoading } = useAuth();
  const { openSignIn } = useSignInModal();
  const { openAddFunds } = useAddFunds();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const [menuOpen, setMenuOpen] = useState(false);

  const signedIn = Boolean(user);
  const cryptoConnected = isConnected && Boolean(address);
  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "Account";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  if (!signedIn) {
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
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-deputy-accent/20 text-xs font-semibold text-deputy-accent">
            {initials(displayName)}
          </span>
        )}
        <span className="hidden max-w-[120px] truncate text-sm font-medium text-white sm:block">
          {displayName}
        </span>
        {cryptoConnected && (
          <span className="hidden h-2 w-2 rounded-full bg-deputy-accent sm:block" title="Wallet connected" />
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
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-deputy-border bg-deputy-panel p-2 shadow-xl">
            <div className="border-b border-deputy-border px-3 py-2.5">
              <p className="truncate text-sm font-medium text-white">{displayName}</p>
              <p className="truncate text-xs text-deputy-muted">{user?.email}</p>
              {!balanceLoading && balance && (
                <p className="mt-1 text-xs text-deputy-accent">
                  ${balance.availableUsd.toFixed(2)} available
                </p>
              )}
              {cryptoConnected && (
                <p className="mt-1 font-mono text-[10px] text-deputy-muted">
                  {address!.slice(0, 6)}…{address!.slice(-4)}
                </p>
              )}
            </div>

            <MenuItem
              onClick={() => {
                openAddFunds();
                setMenuOpen(false);
              }}
            >
              Add funds
            </MenuItem>

            {projectId && (
              <MenuItem
                onClick={() => {
                  open({ view: "Connect" });
                  setMenuOpen(false);
                }}
              >
                {cryptoConnected ? "Wallet settings" : "Connect crypto wallet"}
              </MenuItem>
            )}

            {cryptoConnected && (
              <MenuItem
                onClick={() => {
                  disconnect();
                  setMenuOpen(false);
                }}
              >
                Disconnect wallet
              </MenuItem>
            )}

            <MenuItem
              onClick={async () => {
                if (cryptoConnected) disconnect();
                await signOut();
                setMenuOpen(false);
              }}
              className="text-deputy-warn"
            >
              Sign out
            </MenuItem>
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
