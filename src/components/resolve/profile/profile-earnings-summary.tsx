"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Money } from "@/components/resolve/ui/money";
import { formatDecayUrgencyLabel } from "@/lib/earn/format";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useProfileBootstrap } from "@/components/resolve/profile/profile-bootstrap";

type IdentityRow = {
  label: string;
  payeeKeyType: string;
  claimableUsd: number;
  authorizedUsd: number;
  settledUsd: number;
  verifiedUsd: number;
  authorizationCount: number;
};

type EarningsResponse = {
  signedIn: boolean;
  youEarnedUsd: number;
  claimableUsd: number;
  authorizedUsd: number;
  settledUsd: number;
  stalestClaimableAt: string | null;
  notifyUrgency: number;
  githubLinked: boolean;
  identities: IdentityRow[];
};

function identityKindLabel(payeeKeyType: string): string {
  if (payeeKeyType === "github_username") return "GitHub";
  if (payeeKeyType === "wallet") return "Wallet";
  if (payeeKeyType.startsWith("listen_")) return "Music";
  return "Identity";
}

function identityKindDescription(payeeKeyType: string): string {
  if (payeeKeyType === "github_username") return "Open-source contributions";
  if (payeeKeyType === "wallet") return "On-chain payee key";
  if (payeeKeyType.startsWith("listen_")) return "Plays & credits via MusicBrainz";
  return "Linked payee";
}

export function ProfileEarningsSummary() {
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const { data: bootstrap, loading: bootstrapLoading } = useProfileBootstrap();
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (bootstrapLoading) return;
    if (bootstrap?.signedIn) {
      if (bootstrap.earnings) {
        setData(bootstrap.earnings as EarningsResponse);
      } else {
        setData({
          signedIn: true,
          youEarnedUsd: 0,
          claimableUsd: 0,
          authorizedUsd: 0,
          settledUsd: 0,
          stalestClaimableAt: null,
          notifyUrgency: 0,
          githubLinked: false,
          identities: [],
        });
      }
      setLoading(false);
      return;
    }
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetch("/api/profile/earnings", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => setData(body))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [bootstrap, bootstrapLoading, user]);

  if (loading || bootstrapLoading) {
    return (
      <section className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400/90">
          Your earnings
        </p>
        <div className="flex items-center gap-2 text-sm text-resolve-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading earnings…
        </div>
      </section>
    );
  }

  if (!data?.signedIn) {
    return (
      <section className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400/90">
          Your earnings
        </p>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-sm text-resolve-muted">
            {user ?
              "Connect GitHub or ListenBrainz below — earnings appear here automatically after your first recognized activity."
            : "Sign in to see verified earnings from connected communities."}
          </p>
          {!user && (
            <button
              type="button"
              onClick={() => openSignIn()}
              className="mt-3 text-sm font-medium text-resolve-accent hover:underline"
            >
              Sign in →
            </button>
          )}
        </div>
      </section>
    );
  }

  const urgencyLabel = formatDecayUrgencyLabel(data.stalestClaimableAt);
  const hasEarnings = data.youEarnedUsd > 0 || data.claimableUsd > 0 || data.authorizedUsd > 0;
  const activeIdentities = data.identities.filter(
    (i) => i.claimableUsd > 0 || i.authorizedUsd > 0 || i.settledUsd > 0,
  );

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400/90">
          Your earnings
        </p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          {hasEarnings ? (
            <>
              You earned{" "}
              <Money amount={data.youEarnedUsd} size="lg" className="inline text-emerald-300" />
            </>
          ) : (
            "No verified earnings yet"
          )}
        </h2>
        {!hasEarnings && (
          <p className="mt-2 text-sm text-resolve-muted">
            Connect GitHub or ListenBrainz below — one click each. RESOLVE watches your communities
            and credits earnings automatically.
          </p>
        )}
        {(data.claimableUsd > 0 || data.authorizedUsd > 0) && (
          <p className="mt-2 text-sm text-resolve-muted">
            {data.claimableUsd > 0 && (
              <>
                <Money amount={data.claimableUsd} size="sm" className="inline text-white" /> ready to
                claim
              </>
            )}
            {data.authorizedUsd > 0 && (
              <>
                {data.claimableUsd > 0 ? " · " : ""}
                <Money amount={data.authorizedUsd} size="sm" className="inline" /> recognized, pending
                funding
              </>
            )}
            {data.settledUsd > 0 && (
              <>
                {" "}
                · <Money amount={data.settledUsd} size="sm" className="inline" /> settled
              </>
            )}
          </p>
        )}
        {urgencyLabel && data.claimableUsd > 0 && (
          <p className="mt-1 text-xs text-amber-200/90">{urgencyLabel}</p>
        )}
      </div>

      {data.identities.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-[#0a0f18] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
            By identity
          </p>
          <ul className="mt-3 space-y-3">
            {data.identities.map((identity) => (
              <li
                key={`${identity.payeeKeyType}:${identity.label}`}
                className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{identity.label}</p>
                    <p className="text-[10px] text-resolve-muted">
                      {identityKindLabel(identity.payeeKeyType)} · {identityKindDescription(identity.payeeKeyType)}
                    </p>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    {identity.claimableUsd > 0 && (
                      <p className="text-emerald-300">
                        <Money amount={identity.claimableUsd} size="sm" className="inline" /> claimable
                      </p>
                    )}
                    {identity.authorizedUsd > 0 && (
                      <p className="text-amber-200/90">
                        <Money amount={identity.authorizedUsd} size="sm" className="inline" /> pending
                      </p>
                    )}
                    {identity.settledUsd > 0 && (
                      <p className="text-resolve-muted">
                        <Money amount={identity.settledUsd} size="sm" className="inline" /> settled
                      </p>
                    )}
                    {!identity.claimableUsd && !identity.authorizedUsd && !identity.settledUsd && (
                      <p className="text-resolve-muted-dim">No activity</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeIdentities.length > 0 && data.claimableUsd > 0 && (
        <Link
          href="/claim"
          className="inline-flex items-center justify-center gap-2 rounded-resolve-lg border border-resolve-accent/30 bg-gradient-to-r from-resolve-accent to-blue-500 px-7 py-3.5 text-sm font-semibold text-white shadow-resolve-glow transition-all hover:scale-[1.03]"
        >
          Claim <Money amount={data.claimableUsd} size="sm" className="inline" />
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      {!data.githubLinked && data.claimableUsd <= 0 && (
        <p className="text-xs text-resolve-muted-dim">
          Connect GitHub, ListenBrainz, or your wallet in settings to match ledger payees.
        </p>
      )}
    </section>
  );
}
