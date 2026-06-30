"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

type ClaimSession = {
  claimableUsd: number;
  claimableCount: number;
  payeeLabel: string;
  claimUrl: string | null;
};

/** Top-of-Discover claim teaser — real amounts from GET /api/claim/session only when claimable. */
export function DiscoverClaimHint() {
  const { user } = useAuth();
  const [session, setSession] = useState<ClaimSession | null>(null);

  useEffect(() => {
    if (!user) {
      setSession(null);
      return;
    }
    const load = () =>
      fetch("/api/claim/session", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.signedIn || !(d.claimableUsd > 0)) {
            setSession(null);
            return;
          }
          setSession({
            claimableUsd: d.claimableUsd,
            claimableCount: d.claimableCount ?? 0,
            payeeLabel: d.payeeLabel ?? "you",
            claimUrl: d.claimUrl ?? null,
          });
        })
        .catch(() => setSession(null));

    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [user]);

  if (!user || !session || session.claimableUsd <= 0) return null;

  const claimHref = session.claimUrl ?? "/claim";

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-5 py-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <div>
          <p className="text-sm font-medium text-white">
            ${session.claimableUsd.toFixed(2)} claimable for {session.payeeLabel}
          </p>
          <p className="mt-0.5 text-xs text-resolve-muted">
            {session.claimableCount > 0
              ? `${session.claimableCount} authorization${session.claimableCount === 1 ? "" : "s"} ready — collect on Arc`
              : "Settlement ready — collect to your wallet"}
          </p>
        </div>
      </div>
      <Link
        href={claimHref}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30"
      >
        Collect earnings
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
