"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import clsx from "clsx";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { explorerUrlForTx, isOnChainTxHash } from "@/lib/payment/tx-utils";

type SettlementRow = {
  id: string;
  missionId: string;
  repo: string | null;
  status: string;
  totalUsd: number;
  createdAt: string;
  proofTxHash?: string | null;
};

function mapSettlement(raw: Record<string, unknown>): SettlementRow {
  let proofTxHash: string | null = null;
  if (typeof raw.escrowTxHash === "string") proofTxHash = raw.escrowTxHash;
  if (typeof raw.proofJson === "string") {
    try {
      const proof = JSON.parse(raw.proofJson) as { txHashes?: string[] };
      proofTxHash = proof.txHashes?.[0] ?? proofTxHash;
    } catch {
      /* ignore */
    }
  }
  return {
    id: String(raw.id),
    missionId: String(raw.missionId),
    repo: typeof raw.repo === "string" ? raw.repo : null,
    status: String(raw.status),
    totalUsd: Number(raw.treasuryAmount ?? 0),
    createdAt: String(raw.createdAt),
    proofTxHash,
  };
}

type RewardSummary = {
  claimableUsd: number;
  pendingUsd: number;
  settledUsd: number;
  rewardCount: number;
};

type PendingReward = {
  id: string;
  repo: string | null;
  amountUsd: number;
  status: string;
};

type AuthorizationRow = {
  id: string;
  connectorId: string;
  missionId: string;
  amountUsd: number;
  status: string;
  contextLabel: string | null;
};

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "claim" ? "claim" : "history";
  const { user, signInWithGitHub, githubEnabled } = useAuth();
  const { openSignIn } = useSignInModal();
  const capabilities = useAuthCapabilities();
  const githubOAuthReady = capabilities.loaded && capabilities.github;
  const { open: openWallet } = useAppKit();
  const { address, isConnected } = useAccount();

  const [treasuryUsd, setTreasuryUsd] = useState(0);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [summary, setSummary] = useState<RewardSummary | null>(null);
  const [rewards, setRewards] = useState<PendingReward[]>([]);
  const [authorizations, setAuthorizations] = useState<AuthorizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [treasuryRes, historyRes, rewardsRes] = await Promise.all([
        fetch("/api/treasury"),
        fetch("/api/payment/history"),
        fetch("/api/rewards", { credentials: "include" }),
      ]);
      const treasury = await treasuryRes.json();
      const history = await historyRes.json();
      const rewardsData = await rewardsRes.json();
      setTreasuryUsd(treasury.balanceUsd ?? treasury.treasuryUsd ?? 0);
      setSettlements((history.settlements ?? []).map(mapSettlement));
      setSummary(rewardsData.summary ?? null);
      setRewards(rewardsData.rewards ?? []);
      setAuthorizations(rewardsData.authorizations ?? []);
    } catch {
      toast.error("Could not load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, user]);

  async function handleClaim() {
    if (!isConnected || !address) {
      openWallet({ view: "Connect" });
      return;
    }
    setClaiming(true);
    try {
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ walletAddress: address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      toast.success("Rewards claimed");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Payments</h1>
        <p className="mt-1 text-sm text-resolve-muted">
          Treasury, settlement history, and contributor claims.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border border-resolve-border p-1">
        <TabButton active={tab === "history"} href="/payments">
          History
        </TabButton>
        <TabButton active={tab === "claim"} href="/payments?tab=claim">
          Claim rewards
        </TabButton>
      </div>

      {tab === "history" ?
        <div className="space-y-4">
          <Panel className="p-5">
            <p className="text-[10px] uppercase tracking-wider text-resolve-muted">Treasury</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              <Money amount={treasuryUsd} size="lg" />
            </p>
            <Link
              href="/workspace"
              className="mt-3 inline-block text-sm text-resolve-accent hover:underline"
            >
              Fund a repository →
            </Link>
          </Panel>

          <Panel className="p-4">
            <p className="text-sm font-medium text-white">Settlement history</p>
            {loading ?
              <p className="mt-3 text-sm text-resolve-muted">Loading…</p>
            : settlements.length === 0 ?
              <p className="mt-3 text-sm text-resolve-muted">
                No settlements yet. Analyze a repository in Workspace to distribute funds.
              </p>
            : <ul className="mt-3 divide-y divide-resolve-border">
                {settlements.map((s) => {
                  const tx = s.proofTxHash;
                  const onChain = tx && isOnChainTxHash(tx);
                  const explorer = onChain ? explorerUrlForTx(tx) : null;
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                      <div>
                        <p className="font-medium text-white">{s.repo ?? s.missionId}</p>
                        <p className="text-xs text-resolve-muted">
                          {new Date(s.createdAt).toLocaleDateString()} · {s.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <Money amount={s.totalUsd} size="sm" />
                        {explorer && (
                          <a
                            href={explorer}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 block text-[10px] text-resolve-accent hover:underline"
                          >
                            View transaction
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            }
          </Panel>
        </div>
      : <Panel className="p-5">
          <p className="text-lg font-semibold text-white">Claim authorizations</p>
          {!user ?
            <div className="mt-4 space-y-3">
              <p className="text-sm text-resolve-muted">Sign in with GitHub to see your authorizations.</p>
              <button
                type="button"
                onClick={() => (githubOAuthReady && githubEnabled ? signInWithGitHub() : openSignIn())}
                className="rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Sign in with GitHub
              </button>
            </div>
          : <>
              <p className="mt-2 text-sm text-resolve-muted">
                Claimable:{" "}
                <Money amount={summary?.claimableUsd ?? 0} size="sm" className="inline" />
              </p>
              {loading ?
                <p className="mt-3 text-sm text-resolve-muted">Loading…</p>
              : authorizations.length === 0 && rewards.length === 0 ?
                <p className="mt-3 text-sm text-resolve-muted">No authorizations for your account.</p>
              : <ul className="mt-3 space-y-2 text-sm">
                  {authorizations.map((a) => (
                    <li
                      key={a.id}
                      className="flex justify-between rounded border border-resolve-border px-3 py-2"
                    >
                      <span className="text-resolve-muted">
                        {a.contextLabel ?? a.missionId}
                        <span className="ml-2 text-[10px] uppercase text-resolve-muted-dim">
                          {a.status.replace("_", " ")}
                        </span>
                      </span>
                      <Money amount={a.amountUsd} size="sm" />
                    </li>
                  ))}
                  {rewards.map((r) => (
                    <li
                      key={r.id}
                      className="flex justify-between rounded border border-resolve-border px-3 py-2"
                    >
                      <span className="text-resolve-muted">{r.repo ?? "Mission"}</span>
                      <Money amount={r.amountUsd} size="sm" />
                    </li>
                  ))}
                </ul>
              }
              <div className="mt-4 flex flex-wrap gap-2">
                {!isConnected ?
                  <button
                    type="button"
                    onClick={() => openWallet({ view: "Connect" })}
                    className="rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white"
                  >
                    Connect wallet
                  </button>
                : <button
                    type="button"
                    onClick={() => void handleClaim()}
                    disabled={claiming || (summary?.claimableUsd ?? 0) <= 0}
                    className="rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {claiming ? "Claiming…" : "Claim"}
                  </button>
                }
              </div>
            </>
          }
        </Panel>
      }
    </div>
  );
}

function TabButton({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition",
        active ? "bg-resolve-hover text-white" : "text-resolve-muted hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}
