"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

type ClaimSession = {
  claimableUsd: number;
  claimableCount: number;
  status: string;
  payeeLabel: string;
  githubLinked: boolean;
};

/** Teaser for creators — routes to /claim, not full Profile dashboard. */
export function DiscoverClaimHint() {
  const { user } = useAuth();
  const [session, setSession] = useState<ClaimSession | null>(null);

  useEffect(() => {
    if (!user) {
      setSession(null);
      return;
    }
    void fetch("/api/claim/session", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.signedIn) return setSession(null);
        setSession({
          claimableUsd: d.claimableUsd ?? 0,
          claimableCount: d.claimableCount ?? 0,
          status: d.status ?? "pending",
          payeeLabel: d.payeeLabel ?? "you",
          githubLinked: Boolean(d.githubLinked),
        });
      })
      .catch(() => setSession(null));
  }, [user]);

  if (!user || !session) return null;

  if (session.claimableUsd > 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-5 py-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-white">
              You&apos;ve earned ${session.claimableUsd.toFixed(2)}
            </p>
            <p className="mt-0.5 text-xs text-resolve-muted">
              {session.claimableCount > 0
                ? `${session.claimableCount} authorization${session.claimableCount === 1 ? "" : "s"} ready — collect on Arc`
                : "Settlement ready — collect to your wallet"}
            </p>
          </div>
        </div>
        <Link
          href="/claim"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30"
        >
          Collect earnings
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  if (!session.githubLinked) {
    return (
      <div className="rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/30 px-5 py-4">
        <p className="text-sm text-resolve-muted">
          Link GitHub or connect a community sensor — when connectors recognize your work, earnings
          appear here for collection.
        </p>
        <Link href="/claim" className="mt-2 inline-block text-xs font-medium text-resolve-accent hover:underline">
          Open claim entry →
        </Link>
      </div>
    );
  }

  return null;
}
