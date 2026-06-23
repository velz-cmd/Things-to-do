"use client";

import { useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useDisconnect } from "wagmi";
import clsx from "clsx";
import { useAuth, isSupabaseConfigured } from "@/components/auth/auth-provider";
import { SignInModal } from "@/components/auth/sign-in-modal";
import { AddFundsModal } from "@/components/wallet/add-funds-modal";
import { toast } from "sonner";

import { projectId } from "@/lib/reown/config";

export function ResolveAccountMenu({ compact }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { user, signOut, balance, balanceLoading } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const signedIn = Boolean(user);
  const cryptoConnected = isConnected && address;
  const label = signedIn
    ? user?.email?.split("@")[0] ?? "Account"
    : cryptoConnected
      ? `${address!.slice(0, 6)}…${address!.slice(-4)}`
      : "Sign in";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className={clsx(
          "w-full rounded-lg border border-deputy-border bg-deputy-bg/80 text-left transition hover:border-deputy-accent/40",
          compact ? "px-2.5 py-2 text-xs" : "px-3 py-2.5 text-sm"
        )}
      >
        <p className="font-medium text-white">{label}</p>
        {!compact && signedIn && balance && !balanceLoading && (
          <p className="mt-0.5 text-xs text-deputy-accent">
            ${balance.availableUsd.toFixed(2)} available
          </p>
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
          <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-deputy-border bg-deputy-panel p-2 shadow-xl">
            {signedIn ? (
              <>
                <MenuItem
                  onClick={() => {
                    setAddFundsOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  Add funds
                </MenuItem>
                <MenuItem
                  onClick={async () => {
                    await signOut();
                    setMenuOpen(false);
                  }}
                >
                  Sign out
                </MenuItem>
              </>
            ) : isSupabaseConfigured() ? (
              <MenuItem
                onClick={() => {
                  setSignInOpen(true);
                  setMenuOpen(false);
                }}
              >
                Sign in with Google or email
              </MenuItem>
            ) : null}

            {projectId ? (
              <WalletConnectMenuItem
                cryptoConnected={Boolean(cryptoConnected)}
                onDone={() => setMenuOpen(false)}
              />
            ) : (
              <MenuItem
                onClick={() => {
                  toast.error("WalletConnect not configured", {
                    description: "Set NEXT_PUBLIC_REOWN_PROJECT_ID",
                  });
                  setMenuOpen(false);
                }}
              >
                Connect crypto wallet
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
          </div>
        </>
      )}

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      <AddFundsModal open={addFundsOpen} onClose={() => setAddFundsOpen(false)} />
    </div>
  );
}

function WalletConnectMenuItem({
  cryptoConnected,
  onDone,
}: {
  cryptoConnected: boolean;
  onDone: () => void;
}) {
  const { open } = useAppKit();
  return (
    <MenuItem
      onClick={() => {
        open({ view: "Connect" });
        onDone();
      }}
    >
      {cryptoConnected ? "Wallet settings" : "Connect crypto wallet"}
    </MenuItem>
  );
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg px-3 py-2 text-left text-sm text-deputy-muted transition hover:bg-deputy-bg hover:text-white"
    >
      {children}
    </button>
  );
}
