"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { explorerUrlForTx, isOnChainTxHash } from "@/lib/payment/tx-utils";
import { FxSwapPanel } from "@/components/wallet/fx-swap-panel";
import type { FxSwapHint } from "@/lib/settlement/fx";

type ClaimPreview = {
  ok: boolean;
  payeeKeyType: string;
  payeeKey: string;
  payeeLabel: string;
  amountUsd: number;
  claimableCount: number;
  status: "claimable" | "settled" | "pending";
  signedIn: boolean;
  signedInGithub: string | null;
  identityMatch: boolean;
  requiresGithub: boolean;
  authorizations: {
    id: string;
    connectorId: string;
    missionId: string;
    amountUsd: number;
    contextLabel: string | null;
  }[];
  legacyRewardIds: string[];
  expiresAt: string;
  error?: string;
};

export function ClaimEntry({ embedded = false }: { embedded?: boolean }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user, signInWithGitHub, githubEnabled } = useAuth();
  const { openSignIn } = useSignInModal();
  const capabilities = useAuthCapabilities();
  const githubOAuthReady = capabilities.loaded && capabilities.github;
  const { open: openWallet } = useAppKit();
  const { address, isConnected } = useAccount();

  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimedTx, setClaimedTx] = useState<string | null>(null);
  const [fxHint, setFxHint] = useState<FxSwapHint | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setPreview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/claim/preview?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        setPreview({ ok: false, error: data.error } as ClaimPreview);
      } else {
        setPreview(data);
      }
    } catch {
      setPreview({ ok: false, error: "Could not load claim preview" } as ClaimPreview);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load, user?.id]);

  const canClaim = useMemo(() => {
    if (!preview?.ok || preview.status !== "claimable" || preview.amountUsd <= 0) {
      return false;
    }
    if (preview.requiresGithub && !preview.identityMatch) return false;
    if (!isConnected || !address) return false;
    return true;
  }, [preview, isConnected, address]);

  const claim = async () => {
    if (!address || !preview?.ok) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          authorizationIds: preview.authorizations.map((a) => a.id),
          rewardIds: preview.legacyRewardIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Claim failed");
        return;
      }
      const tx = data.claimed?.find((c: { txHash?: string }) => c.txHash)?.txHash;
      if (tx) setClaimedTx(tx);
      if (data.fxHint) setFxHint(data.fxHint);
      toast.success(`Claimed $${data.totalUsd?.toFixed(2) ?? preview.amountUsd.toFixed(2)}`);
      void load();
    } catch {
      toast.error("Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const wrap = (content: React.ReactNode) =>
    embedded ? content : <div className="mx-auto max-w-lg px-4 py-10">{content}</div>;

  if (!token) {
    return wrap(
      <Panel variant="glass">
        {!embedded && <h1 className="text-lg font-semibold text-white">Claim earnings</h1>}
        <p className={clsx("text-sm text-resolve-muted", !embedded && "mt-2")}>
          Open the link from your earn notification, or go to{" "}
          <Link href="/payments" className="text-emerald-300 hover:underline">
            Payments
          </Link>{" "}
          if you are already signed in.
        </p>
      </Panel>,
    );
  }

  if (loading) {
    return wrap(<p className="text-sm text-resolve-muted">Loading your earnings…</p>);
  }

  if (!preview?.ok) {
    return wrap(
      <Panel variant="glass">
        <h1 className="text-lg font-semibold text-white">Claim link invalid</h1>
        <p className="mt-2 text-sm text-amber-200">
          {(preview as { error?: string })?.error ?? "This link expired or was already used."}
        </p>
        <Link href="/payments" className="mt-4 inline-block text-sm text-emerald-300 hover:underline">
          Go to Payments
        </Link>
      </Panel>,
    );
  }

  return wrap(
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-emerald-400/90">You earned</p>
        <h1 className="mt-1 text-3xl font-semibold text-white">
          <Money amount={preview.amountUsd} size="lg" />
        </h1>
        <p className="mt-2 text-sm text-resolve-muted">
          For <span className="text-white">{preview.payeeLabel}</span>
          {preview.claimableCount > 1 ? ` · ${preview.claimableCount} authorizations` : ""}
        </p>
      </div>

      <Panel variant="glow" className="space-y-4">
        {preview.status === "settled" ? (
          <p className="text-sm text-emerald-300">These earnings were already claimed.</p>
        ) : preview.status === "pending" ? (
          <p className="text-sm text-amber-200">
            Settlement is still processing. Check back soon or watch for another notification.
          </p>
        ) : (
          <>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Step done={preview.signedIn && preview.identityMatch} n={1} />
                <div>
                  <p className="font-medium text-white">Sign in with GitHub</p>
                  <p className="text-resolve-muted">Prove you are {preview.payeeLabel}</p>
                  {preview.signedIn && preview.identityMatch ? (
                    <p className="mt-1 text-emerald-300">Signed in as @{preview.signedInGithub}</p>
                  ) : preview.requiresGithub ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (githubOAuthReady && githubEnabled) void signInWithGitHub();
                        else openSignIn();
                      }}
                      className="mt-2 rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15"
                    >
                      Continue with GitHub
                    </button>
                  ) : null}
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Step done={isConnected} n={2} />
                <div>
                  <p className="font-medium text-white">Connect wallet</p>
                  <p className="text-resolve-muted">Receive USDC on Arc testnet</p>
                  {!isConnected && (
                    <button
                      type="button"
                      onClick={() => openWallet()}
                      className="mt-2 rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15"
                    >
                      Connect wallet
                    </button>
                  )}
                  {isConnected && address && (
                    <p className="mt-1 font-mono text-xs text-emerald-300">
                      {address.slice(0, 6)}…{address.slice(-4)}
                    </p>
                  )}
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Step done={Boolean(claimedTx)} n={3} />
                <div className="flex-1">
                  <p className="font-medium text-white">Claim</p>
                  <button
                    type="button"
                    disabled={!canClaim || claiming}
                    onClick={() => void claim()}
                    className={clsx(
                      "mt-2 w-full rounded-md px-4 py-2 text-sm font-medium",
                      canClaim
                        ? "bg-emerald-500 text-black hover:bg-emerald-400"
                        : "cursor-not-allowed bg-white/10 text-resolve-muted",
                    )}
                  >
                    {claiming ? "Claiming…" : `Claim $${preview.amountUsd.toFixed(2)}`}
                  </button>
                  {claimedTx && isOnChainTxHash(claimedTx) && (() => {
                    const explorer = explorerUrlForTx(claimedTx);
                    return explorer ? (
                      <a
                        href={explorer}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block text-xs text-emerald-300 hover:underline"
                      >
                        View transaction
                      </a>
                    ) : null;
                  })()}
                </div>
              </li>
            </ol>
          </>
        )}
      </Panel>

      <p className="text-center text-xs text-resolve-muted">
        Link expires {new Date(preview.expiresAt).toLocaleString()}
      </p>

      {fxHint && (
        <div className="mt-4">
          <FxSwapPanel hint={fxHint} />
        </div>
      )}
    </div>,
  );
}

function Step({ done, n }: { done: boolean; n: number }) {
  return (
    <span
      className={clsx(
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        done ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-resolve-muted",
      )}
    >
      {done ? "✓" : n}
    </span>
  );
}
