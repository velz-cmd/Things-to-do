"use client";

import clsx from "clsx";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Compact account chip for sidebar — primary sign-in is top-right AuthHeader */
export function ResolveAccountMenu({ compact }: { compact?: boolean }) {
  const { balance, balanceLoading } = useAuth();
  const account = useResolveAccount();
  const { openSignIn } = useSignInModal();

  if (!account.isAuthenticated) {
    return (
      <button
        type="button"
        onClick={openSignIn}
        className={clsx(
          "w-full rounded-lg border border-dashed border-deputy-border/80 text-left text-deputy-muted transition hover:border-deputy-accent/40 hover:text-white",
          compact ? "px-2.5 py-2 text-xs" : "px-3 py-2.5 text-sm"
        )}
      >
        Not signed in
      </button>
    );
  }

  const displayName = account.displayName ?? "Account";

  return (
    <div
      className={clsx(
        "w-full rounded-lg border border-deputy-border bg-deputy-bg/80",
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-deputy-accent/20 text-[10px] font-semibold text-deputy-accent">
          {initials(displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{displayName}</p>
          {!balanceLoading && balance && (
            <p className="text-xs text-deputy-accent">
              ${balance.availableUsd.toFixed(2)}
            </p>
          )}
        </div>
      </div>
      {account.appWalletAddress && account.accountVerified && (
        <p className="mt-1 font-mono text-[10px] text-deputy-muted">
          RESOLVE wallet · {account.appWalletAddress.slice(0, 6)}…
          {account.appWalletAddress.slice(-4)}
        </p>
      )}
      {!account.appWalletAddress && account.externalWalletAddress && (
        <p className="mt-1 font-mono text-[10px] text-deputy-muted">
          {account.externalWalletAddress.slice(0, 6)}…
          {account.externalWalletAddress.slice(-4)}
        </p>
      )}
      {account.accountVerified && (
        <p className="mt-1 text-[10px] text-deputy-muted">
          Signed in · wallet locked to account
        </p>
      )}
    </div>
  );
}
