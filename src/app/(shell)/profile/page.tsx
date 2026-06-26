"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wallet, GitBranch, LogOut, Plug, Bell } from "lucide-react";
import { useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { toast } from "sonner";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut, signInWithGitHub, githubEnabled, balance, balanceLoading } = useAuth();
  const { openSignIn } = useSignInModal();
  const account = useResolveAccount();
  const capabilities = useAuthCapabilities();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();

  async function linkGitHub() {
    if (githubEnabled && capabilities.github) {
      await signInWithGitHub();
    } else {
      openSignIn();
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Profile</h1>
        <p className="mt-1 text-sm text-resolve-muted">Who am I — identity, wallet, and preferences.</p>
      </div>

      <Panel className="p-5">
        <p className="text-[10px] uppercase tracking-wider text-resolve-muted">Account</p>
        {user ?
          <p className="mt-1 text-sm text-white">{user.email ?? "Signed in"}</p>
        : <button
            type="button"
            onClick={() => openSignIn()}
            className="mt-2 text-sm text-resolve-accent hover:underline"
          >
            Sign in
          </button>
        }
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-resolve-muted" />
          <p className="text-sm font-medium text-white">GitHub</p>
        </div>
        <p className="mt-1 text-xs text-resolve-muted">
          Required to claim authorizations as a contributor.
        </p>
        <button
          type="button"
          onClick={() => void linkGitHub()}
          className="mt-3 rounded-md border border-resolve-border px-4 py-2 text-sm text-white hover:bg-resolve-hover"
        >
          {user ? "Manage GitHub" : "Connect GitHub"}
        </button>
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-resolve-muted" />
          <p className="text-sm font-medium text-white">Wallet</p>
        </div>
        <p className="mt-1 text-sm text-white">
          {balanceLoading ?
            "Loading…"
          : <>
              <Money amount={balance?.availableUsd ?? 0} size="sm" className="inline" /> available
            </>
          }
        </p>
        {account.externalWalletAddress && (
          <p className="mt-1 font-mono text-xs text-resolve-muted">
            {account.externalWalletAddress.slice(0, 8)}…{account.externalWalletAddress.slice(-6)}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => open({ view: "Connect" })}
            className="rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white"
          >
            {account.externalWalletAddress ? "Switch wallet" : "Connect wallet"}
          </button>
          {account.externalWalletAddress && (
            <button
              type="button"
              onClick={() => {
                disconnect();
                toast.success("Wallet disconnected");
              }}
              className="rounded-md border border-resolve-border px-4 py-2 text-sm text-resolve-muted"
            >
              Disconnect
            </button>
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-resolve-muted" />
          <p className="text-sm font-medium text-white">Connectors</p>
        </div>
        <p className="mt-1 text-xs text-resolve-muted">
          Gmail {account.gmailInboxConnected ? "connected" : "not connected"} · Arc{" "}
          {account.arcConnected ? "ready" : "off-chain mode"}
        </p>
        <Link
          href="/connectors"
          className="mt-3 inline-block text-sm text-resolve-accent hover:underline"
        >
          Manage connectors →
        </Link>
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-resolve-muted" />
          <p className="text-sm font-medium text-white">Notifications</p>
        </div>
        <p className="mt-1 text-xs text-resolve-muted">
          Settlement and claim alerts — configured when notification service ships.
        </p>
      </Panel>

      {user && (
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          className="inline-flex items-center gap-1.5 text-sm text-resolve-muted hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      )}
    </div>
  );
}
