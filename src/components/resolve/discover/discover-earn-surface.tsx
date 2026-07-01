"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  ExternalLink,
  GitBranch,
  Loader2,
  Music,
  Receipt,
  Sparkles,
  Tv,
} from "lucide-react";
import clsx from "clsx";
import { Money } from "@/components/resolve/ui/money";
import { Button } from "@/components/resolve/ui/button";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { formatDecayUrgencyLabel } from "@/lib/earn/format";
import { friendlyReceiptStatus } from "@/lib/receipt/copy";
import type { ProfileEarningsSummary } from "@/lib/earn/summary";
import type { EarnEligibilityRule } from "@/lib/earn/eligibility-copy";
import type { EarnReceiptSnippet } from "@/lib/earn/recent-receipts";
import type { DiscoverEarnConnector } from "@/lib/earn/discover-types";

type DiscoverEarnPayload = {
  signedIn: boolean;
  earnings?: ProfileEarningsSummary;
  connectors?: DiscoverEarnConnector[];
  recentReceipts?: EarnReceiptSnippet[];
  claimUrl?: string | null;
  eligibility: EarnEligibilityRule[];
};

const DEFAULT_CONNECTORS: DiscoverEarnConnector[] = [
  {
    id: "github",
    label: "GitHub",
    connected: false,
    authorizeUrl: "/connect/github",
    hint: "Match OSS contributions to your payee key",
  },
  {
    id: "listenbrainz",
    label: "ListenBrainz",
    connected: false,
    authorizeUrl: "/connect/listenbrainz",
    hint: "Sync plays from any scrobbling app",
  },
  {
    id: "jellyfin",
    label: "Jellyfin",
    connected: false,
    authorizeUrl: "/connect/jellyfin",
    hint: "Credit video watches in funded programs",
  },
  {
    id: "musicbrainz",
    label: "MusicBrainz",
    connected: false,
    authorizeUrl: "/communities/navidrome",
    hint: "Link your artist identity for play attribution",
  },
];

const CONNECTOR_ICONS = {
  github: GitBranch,
  listenbrainz: Music,
  jellyfin: Tv,
  musicbrainz: Music,
} as const;

type DiscoverEarnSurfaceProps = {
  signedIn: boolean;
};

export function DiscoverEarnSurface({ signedIn }: DiscoverEarnSurfaceProps) {
  const { openSignIn } = useSignInModal();
  const [data, setData] = useState<DiscoverEarnPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return fetch("/api/earn/discover", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("earn"))))
      .then((body: DiscoverEarnPayload) => {
        setData(body);
        setLastLoaded(new Date().toISOString());
      })
      .catch(() => setError("Could not load earn summary"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load, signedIn]);

  const earnings = data?.earnings;
  const hasEarnings =
    Boolean(earnings) &&
    (earnings!.youEarnedUsd > 0 ||
      earnings!.claimableUsd > 0 ||
      earnings!.authorizedUsd > 0);
  const urgencyLabel =
    earnings?.stalestClaimableAt && earnings.claimableUsd > 0
      ? formatDecayUrgencyLabel(earnings.stalestClaimableAt)
      : null;

  return (
    <DiscoverPremiumSection
      id="earn"
      title="How much have I earned?"
      subtitle="Ledger-backed totals from your communities — sources sync in the background, claim on Arc"
      className="mb-8 scroll-mt-24"
      actions={
        <DiscoverSectionRefresh
          sectionId="earn-surface"
          onRefresh={load}
          lastUpdated={lastLoaded}
        />
      }
    >
      {loading && (
        <div className="flex items-center gap-2 text-sm text-resolve-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading earnings from ledger…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-dashed border-rose-500/30 px-4 py-3 text-sm text-resolve-muted">
          {error}
        </div>
      )}

      {!loading && data && !data.signedIn && (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/70 p-5">
              <p className="text-sm text-resolve-muted">
                Sign in to see verified earnings from your communities. OSS contributions, music plays,
                and video watches match to your payee key automatically once sources are active.
              </p>
              <Button className="mt-4" onClick={() => openSignIn()}>
                Sign in to see earnings
              </Button>
            </div>
            <ConnectorGrid connectors={data.connectors ?? DEFAULT_CONNECTORS} />
          </div>
          <EligibilityPanel rules={data.eligibility} />
        </div>
      )}

      {!loading && data?.signedIn && earnings && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
                You earned
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {hasEarnings ? (
                  <Money amount={earnings.youEarnedUsd} size="lg" className="text-emerald-300" />
                ) : (
                  <span className="text-resolve-muted">$0 verified</span>
                )}
              </p>
              <p className="mt-2 text-sm text-resolve-muted">
                {earnings.claimableUsd > 0 && (
                  <>
                    <Money amount={earnings.claimableUsd} size="sm" className="inline text-white" />{" "}
                    ready to claim
                  </>
                )}
                {earnings.authorizedUsd > 0 && (
                  <>
                    {earnings.claimableUsd > 0 ? " · " : ""}
                    <Money amount={earnings.authorizedUsd} size="sm" className="inline" /> recognized,
                    pending funding
                  </>
                )}
                {earnings.settledUsd > 0 && !earnings.claimableUsd && !earnings.authorizedUsd && (
                  <>
                    <Money amount={earnings.settledUsd} size="sm" className="inline" /> settled on Arc
                  </>
                )}
                {!hasEarnings && "Activate a source below — earnings appear after recognized activity."}
              </p>
              {urgencyLabel && (
                <p className="mt-2 text-xs text-amber-200/90">{urgencyLabel}</p>
              )}
              {earnings.claimableUsd > 0 && (
                <Link
                  href={data.claimUrl ?? "/claim"}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30"
                >
                  <Sparkles className="h-4 w-4" />
                  Claim <Money amount={earnings.claimableUsd} size="sm" className="inline" />
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            <ConnectorGrid connectors={data.connectors ?? []} />
          </div>

          {(data.recentReceipts?.length ?? 0) > 0 && (
            <ReceiptHistory receipts={data.recentReceipts!} />
          )}

          {!hasEarnings && <EligibilityPanel rules={data.eligibility} />}

          {earnings.identities.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                By identity
              </p>
              <ul className="mt-3 space-y-2">
                {earnings.identities.map((identity) => (
                  <li
                    key={`${identity.payeeKeyType}:${identity.label}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-white">{identity.label}</span>
                    <span className="tabular-nums text-xs text-resolve-muted">
                      {identity.claimableUsd > 0 && (
                        <span className="text-emerald-300">
                          ${identity.claimableUsd.toFixed(2)} claimable
                        </span>
                      )}
                      {identity.authorizedUsd > 0 && (
                        <span className="text-amber-200/90">
                          {identity.claimableUsd > 0 ? " · " : ""}$
                          {identity.authorizedUsd.toFixed(2)} pending
                        </span>
                      )}
                      {!identity.claimableUsd && !identity.authorizedUsd && (
                        <span className="text-resolve-muted-dim">No activity</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs">
            <Link href="/claim" className="text-resolve-accent hover:underline">
              Full claim flow →
            </Link>
          </div>
        </div>
      )}
    </DiscoverPremiumSection>
  );
}

function ConnectorGrid({ connectors }: { connectors: DiscoverEarnConnector[] }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/60 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
        Your sources
      </p>
      <ul className="mt-3 space-y-2">
        {connectors.map((c) => {
          const Icon = CONNECTOR_ICONS[c.id];
          const href = c.authorizeUrl;
          return (
            <li
              key={c.id}
              className={clsx(
                "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                c.connected
                  ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                  : "border-white/[0.06] bg-white/[0.02]",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-resolve-muted" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{c.label}</p>
                  <p className="truncate text-[10px] text-resolve-muted">
                    {c.connected ? (c.displayValue ?? "Connected") : (c.hint ?? "Not connected")}
                  </p>
                </div>
              </div>
              {c.connected ? (
                <span className="shrink-0 text-[10px] font-medium text-emerald-400">Live</span>
              ) : (
                <Link
                  href={href}
                  className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] font-medium text-resolve-accent hover:bg-white/5"
                >
                  Enable
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReceiptHistory({ receipts }: { receipts: EarnReceiptSnippet[] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex items-center gap-2">
        <Receipt className="h-4 w-4 text-resolve-muted" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
          Recent receipts
        </p>
      </div>
      <ul className="mt-3 divide-y divide-white/[0.06]">
        {receipts.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
            <div className="min-w-0">
              <p className="truncate text-sm text-white">
                {r.contextLabel ?? r.eventType.replace(/_/g, " ")}
              </p>
              <p className="text-[10px] text-resolve-muted-dim">
                {r.connectorId} · {friendlyReceiptStatus(r.status)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-medium tabular-nums text-emerald-300">
                ${r.amountUsd.toFixed(2)}
              </span>
              <Link
                href={r.receiptHref}
                className="inline-flex items-center gap-0.5 text-[10px] text-resolve-accent hover:underline"
              >
                Receipt
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EligibilityPanel({ rules }: { rules: EarnEligibilityRule[] }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <CircleDollarSign className="h-4 w-4 text-resolve-muted" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
          Eligibility thresholds
        </p>
      </div>
      <p className="mt-2 text-xs text-resolve-muted-dim">
        Estimates on opportunity cards use these minimums — your ledger total above is always
        verified, never estimated.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2.5"
          >
            <p className="text-xs font-medium text-white">{rule.label}</p>
            <p className="mt-0.5 text-[11px] text-emerald-300/90">{rule.threshold}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-resolve-muted-dim">{rule.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
