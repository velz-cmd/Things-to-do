"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Gift, GitBranch, Wallet } from "lucide-react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { useAppKit } from "@reown/appkit/react";

type RewardSummary = {
  claimableUsd: number;
  pendingUsd: number;
  settledUsd: number;
  verifiedUsd: number;
  rewardCount: number;
};

type PendingReward = {
  id: string;
  missionId: string;
  repo: string | null;
  amountUsd: number;
  weight: number;
  status: string;
  proofHash: string;
  createdAt: string;
};

export default function ClaimPage() {
  const { user, signInWithGitHub, githubEnabled } = useAuth();
  const { openSignIn } = useSignInModal();
  const capabilities = useAuthCapabilities();
  const githubOAuthReady = capabilities.loaded && capabilities.github;
  const { open: openWallet } = useAppKit();
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [githubLinked, setGithubLinked] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [summary, setSummary] = useState<RewardSummary | null>(null);
  const [rewards, setRewards] = useState<PendingReward[]>([]);

  const loadRewards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rewards", { credentials: "include" });
      const data = await res.json();
      setGithubLinked(Boolean(data.githubLinked));
      setGithubUsername(data.githubUsername ?? null);
      setSummary(data.summary ?? null);
      setRewards(data.rewards ?? []);
    } catch {
      toast.error("Could not load rewards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRewards();
  }, [loadRewards, user]);

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
      toast.success(`Claimed $${data.totalUsd} to your wallet`);
      await loadRewards();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <span className="inline-block rounded border border-violet-500/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-violet-300">
          Claim Portal
        </span>
        <h1 className="mt-2 text-2xl font-bold text-white">Your RESOLVE rewards</h1>
        <p className="mt-1 text-sm text-resolve-muted">
          GitHub contributors earn rewards automatically. Connect GitHub once, link a wallet, and
          claim verified allocations — no pre-registration required.
        </p>
      </div>

      {!githubOAuthReady && (
        <Panel className="border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200">
          <p className="font-medium text-amber-100">GitHub sign-in not configured yet</p>
          <p className="mt-1">
            Enable GitHub in Supabase → Authentication → Providers, then redeploy. Until then,
            founders can still settle from <Link href="/weight" className="underline">/weight</Link>;
            contributors cannot claim from this page yet.
          </p>
        </Panel>
      )}

      {!user && githubOAuthReady && (
        <Panel className="p-5">
          <p className="text-sm text-white">Step 1 — prove your GitHub identity</p>
          <p className="mt-1 text-xs text-resolve-muted">
            Sign in with the same GitHub account that contributed to the repository.
          </p>
          <button
            type="button"
            onClick={() => {
              if (githubEnabled) void signInWithGitHub();
              else openSignIn();
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900"
          >
            <GitBranch className="h-4 w-4" />
            Continue with GitHub
          </button>
        </Panel>
      )}

      {user && !githubLinked && (
        <Panel className="border-amber-500/20 p-5">
          <p className="text-sm text-amber-200">Link your GitHub account to see rewards</p>
          <button
            type="button"
            onClick={() => void signInWithGitHub()}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/20 px-4 py-2 text-sm text-white"
          >
            <GitBranch className="h-4 w-4" />
            Connect GitHub
          </button>
        </Panel>
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Claimable" amount={summary.claimableUsd} accent />
          <Stat label="Verified" amount={summary.verifiedUsd} />
          <Stat label="Settled" amount={summary.settledUsd} />
          <Stat label="Pending" amount={summary.pendingUsd} warn />
        </div>
      )}

      {githubUsername && (
        <Panel className="p-4 text-xs text-resolve-muted">
          Signed in as <span className="text-white">@{githubUsername}</span>
          {isConnected && address && (
            <>
              {" "}
              · Wallet <span className="font-mono text-white">{address.slice(0, 10)}…</span>
            </>
          )}
        </Panel>
      )}

      <Panel className="p-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-violet-400" />
          <p className="text-sm font-medium text-white">Pending rewards</p>
        </div>
        {loading && <p className="mt-3 text-xs text-resolve-muted">Loading…</p>}
        {!loading && rewards.length === 0 && (
          <p className="mt-3 text-xs text-resolve-muted">
            No claimable rewards yet. When a founder settles a mission you contributed to, rewards
            appear here automatically.
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {rewards.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded border border-resolve-border bg-resolve-bg/40 px-3 py-2 text-xs"
            >
              <div>
                <p className="font-medium text-white">{r.repo ?? r.missionId}</p>
                <p className="text-resolve-muted">
                  Weight {r.weight} · {r.status}
                </p>
              </div>
              <Money amount={r.amountUsd} size="sm" />
            </li>
          ))}
        </ul>
      </Panel>

      {summary && summary.claimableUsd > 0 && (
        <button
          type="button"
          onClick={() => void handleClaim()}
          disabled={claiming}
          className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          <Wallet className="h-4 w-4" />
          {claiming ? "Claiming on Arc…" : `Claim $${summary.claimableUsd.toFixed(2)}`}
        </button>
      )}

      <p className="text-xs text-resolve-muted">
        Founders: allocate on{" "}
        <Link href="/weight" className="text-resolve-accent hover:underline">
          Weight Council
        </Link>
        . Contributors never need to register wallets in advance.
      </p>
    </div>
  );
}

function Stat({
  label,
  amount,
  accent,
  warn,
}: {
  label: string;
  amount: number;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <Panel className="p-3">
      <p className="text-[10px] uppercase text-resolve-muted">{label}</p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums ${
          warn ? "text-amber-300" : accent ? "text-emerald-400" : "text-white"
        }`}
      >
        ${amount.toFixed(2)}
      </p>
    </Panel>
  );
}
