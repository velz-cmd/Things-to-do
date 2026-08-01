"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, ExternalLink, RefreshCw, WalletCards } from "lucide-react";
import type { WorkspaceReadinessState } from "@/lib/workspace/readiness-contract";
import { PayoutDestinationDrawer } from "@/components/resolve/profile/payout-destination-drawer";

export type ContributorIdentityView = {
  id: string;
  canonicalRef: string;
  displayName: string | null;
};

export type ContributorPayoutView = {
  id: string;
  identityId: string | null;
  network: string;
  address: string;
};

export type ContributorWorkView = {
  id: string;
  workUrl: string;
  status: string;
  updatedAt: string;
  campaignId: string;
  provider: string;
  receiptPublicReference: string | null;
};

type GithubReadiness = {
  state: WorkspaceReadinessState;
  account: string | null;
} | null;

async function post(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
    blocker?: string;
  };
  if (!response.ok) throw new Error(data.error ?? "Action could not complete.");
  return data;
}

export function OutcomeContributorConsole({
  identities,
  payouts,
  work,
  githubReadiness,
}: {
  identities: ContributorIdentityView[];
  payouts: ContributorPayoutView[];
  work: ContributorWorkView[];
  githubReadiness?: GithubReadiness;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const githubConnected = Boolean(
    githubReadiness &&
      ["connected", "syncing", "stale"].includes(githubReadiness.state),
  );
  const hasGithubIdentity = identities.some((identity) =>
    identity.canonicalRef.startsWith("github:"),
  );
  const hasPeertubeWork = work.some((item) => item.provider === "peertube");
  const canonicalPayout = payouts.find((item) => item.identityId === null);

  async function run(key: string, url: string, body?: Record<string, unknown>) {
    if (busy) return;
    setBusy(key);
    setMessage(null);
    try {
      const requestBody =
        key === "peertube"
          ? {
              ...body,
              submissionId: work.find((item) => item.provider === "peertube")?.id,
            }
          : body;
      const result = await post(url, requestBody);
      setMessage(
        typeof result.blocker === "string"
          ? result.blocker
          : "Action completed and recorded.",
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section
        id="identity-payouts"
        className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-cyan-300">
              Identity and payouts
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Bind proof to the person who gets paid
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              RESOLVE accepts an authenticated provider identity and routes its
              obligations only to a verified app wallet.
            </p>
            {githubConnected && (
              <p className="mt-2 text-xs text-emerald-300">
                GitHub connected
                {githubReadiness?.account ? ` as ${githubReadiness.account}` : ""}.
                This state is shared with Profile and Discover.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {!canonicalPayout ? (
              <button type="button" onClick={() => setPayoutOpen(true)} className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white">Choose payout wallet</button>
            ) : null}
            {!hasGithubIdentity && (
              <button
                type="button"
                onClick={() =>
                  run("github", "/api/outcomes/identity", {
                    action: "connect_identity",
                    provider: "github",
                  })
                }
                disabled={Boolean(busy)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-50"
              >
                {githubConnected ? "Use connected GitHub" : "Connect GitHub"}
              </button>
            )}
            {hasPeertubeWork && (
              <button
                type="button"
                onClick={() =>
                  run("peertube", "/api/outcomes/identity", {
                    action: "connect_identity",
                    provider: "peertube",
                  })
                }
                disabled={Boolean(busy)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-50"
              >
                Verify PeerTube
              </button>
            )}
          </div>
        </div>
        {message && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm text-cyan-100"
          >
            {message}
          </p>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {identities.map((identity) => {
            const payout = payouts.find((item) => item.identityId === identity.id) ?? canonicalPayout;
            return (
              <article key={identity.id} className="rounded-xl border border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-emerald-300" />
                  <strong className="text-sm text-white">
                    {identity.displayName ?? identity.canonicalRef}
                  </strong>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {identity.canonicalRef}
                </p>
                {payout ? (
                  <p className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                    <WalletCards className="h-4 w-4 text-violet-300" />
                    {payout.network} · {payout.address.slice(0, 8)}...
                    {payout.address.slice(-6)}
                  </p>
                ) : (
                  <button type="button" onClick={() => setPayoutOpen(true)} className="mt-3 rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white">Choose payout wallet</button>
                )}
              </article>
            );
          })}
          {!identities.length && (
            <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400 md:col-span-2">
              {githubConnected
                ? "GitHub is connected. Use it once to create the campaign identity required for payout attribution."
                : "No verified campaign identity yet. Connect the provider used by the campaign. RESOLVE does not infer identity from a matching label."}
            </p>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-violet-300">My work</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Verification queue</h2>
          </div>
          <Link href="/discover?view=explore&kind=programs" className="text-sm text-violet-300">
            Browse programs
          </Link>
        </div>
        {work.length ? (
          <div className="mt-4 divide-y divide-white/10">
            {work.map((item) => (
              <article
                key={item.id}
                className="grid gap-3 py-4 md:grid-cols-[1fr_160px_auto]"
              >
                <div>
                  <a
                    href={item.workUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-white hover:text-cyan-300"
                  >
                    {item.workUrl}
                  </a>
                  <p className="mt-1 text-xs text-slate-500">
                    Updated {new Date(item.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-sm text-slate-400">
                  {item.status.replaceAll("_", " ")}
                </span>
                <div className="flex gap-2">
                  {item.receiptPublicReference ? (
                    <Link
                      href={`/outcomes/${item.receiptPublicReference}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/20 px-3 py-2 text-xs text-emerald-200"
                    >
                      Receipt <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        run(
                          `sync:${item.id}`,
                          `/api/outcomes/submissions/${item.id}/synchronize`,
                        )
                      }
                      disabled={Boolean(busy)}
                      className="inline-flex items-center gap-1 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Synchronize
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
            You have not joined a campaign yet.
          </p>
        )}
      </section>
      <PayoutDestinationDrawer open={payoutOpen} origin="earn" onChanged={(value) => { setMessage(value); router.refresh(); }} onClose={() => setPayoutOpen(false)} />
    </>
  );
}
