"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { useSignInModal } from "@/components/auth/sign-in-context";
import type {
  DiscoverPerson,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";

type FundingReview = {
  mode: "outcome" | "selected_provider" | "sponsorship";
  recipient?: string;
  purpose: string;
  amountUsd: number;
  token: string;
  network: string;
  fees: {
    platformUsd: number | null;
    networkUsd: number | null;
    message: string;
  };
  releaseCondition: string;
  refundCondition: string;
  createsDeliveryObligation: boolean;
  reservationNotice: string | null;
  transactionExecuted: false;
  canConfirm: false;
  blocker: string;
};

function emit(event: string, properties?: Record<string, string | number | boolean>) {
  void fetch("/api/discover/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, properties, path: window.location.pathname }),
    keepalive: true,
  });
}

export function OpportunityActions({
  opportunity,
  providers,
  signedIn,
  canManage,
}: {
  opportunity: MarketplaceOpportunity;
  providers: DiscoverPerson[];
  signedIn: boolean;
  canManage: boolean;
}) {
  const { openSignIn } = useSignInModal();
  const [panel, setPanel] = useState<"apply" | "fund" | "provider" | null>(null);
  const [proposal, setProposal] = useState("");
  const [evidence, setEvidence] = useState("");
  const [providerId, setProviderId] = useState(
    opportunity.provider.selected?.id ?? opportunity.provider.preferred?.id ?? "",
  );
  const [fundingMode, setFundingMode] = useState<FundingReview["mode"]>("outcome");
  const [amount, setAmount] = useState(String(opportunity.reward?.amountUsd ?? ""));
  const [review, setReview] = useState<FundingReview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const requireSignIn = (next: typeof panel) => {
    if (!signedIn) {
      openSignIn();
      return false;
    }
    setPanel(next);
    return true;
  };

  const apply = async () => {
    if (busy) return;
    setBusy("apply");
    try {
      const response = await fetch("/api/discover/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          proposal,
          evidenceLinks: evidence
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Application failed");
      emit("application_submitted", { type: opportunity.type });
      toast.success("Application submitted");
      setPanel(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Application failed");
    } finally {
      setBusy(null);
    }
  };

  const selectProvider = async (mode: "preferred" | "selected") => {
    if (busy || !providerId) return;
    setBusy("provider");
    try {
      const response = await fetch("/api/discover/provider-selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          providerId,
          mode,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Provider selection failed");
      emit("provider_selected", { mode });
      toast.success(
        mode === "selected" ? "Provider selected" : "Preferred provider saved",
      );
      setPanel(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider selection failed");
    } finally {
      setBusy(null);
    }
  };

  const buildFundingReview = async () => {
    if (busy) return;
    setBusy("fund");
    setReview(null);
    try {
      const response = await fetch("/api/discover/funding-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          mode: fundingMode,
          amountUsd: Number(amount),
          providerId: fundingMode === "outcome" ? undefined : providerId,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Funding review failed");
      setReview(result.review);
      emit("opportunity_funding_started", { mode: fundingMode });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Funding review failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-[#091321] p-5 shadow-[0_20px_50px_rgba(0,0,0,.18)]">
      <div className="fixed inset-x-3 bottom-3 z-50 flex gap-2 rounded-2xl border border-white/10 bg-[#07111f]/95 p-2 shadow-2xl backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => {
            if (requireSignIn("apply")) emit("application_started", { type: opportunity.type });
          }}
          disabled={opportunity.provider.preference === "invite_only"}
          className="min-h-11 flex-1 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => requireSignIn("fund")}
          className="min-h-11 flex-1 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] px-4 text-sm font-semibold text-emerald-200"
        >
          Review funding
        </button>
      </div>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Next action</p>
      <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
        {opportunity.reward?.amountUsd != null && (
          <>
            <p className="text-xs text-slate-500">Available reward</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              ${opportunity.reward.amountUsd.toLocaleString()} {opportunity.reward.token ?? "USDC"}
            </p>
          </>
        )}
        <p className="mt-3 text-xs leading-5 text-slate-400">
          {opportunity.provider.selected
            ? `Assigned to ${opportunity.provider.selected.name}`
            : opportunity.provider.preferred
              ? `Preferred provider: ${opportunity.provider.preferred.name}`
              : opportunity.provider.preference === "invite_only"
                ? "Applications are invite only."
                : "Applications are open."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          if (requireSignIn("apply")) emit("application_started", { type: opportunity.type });
        }}
        disabled={opportunity.provider.preference === "invite_only"}
        className="mt-4 min-h-11 w-full rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Apply
      </button>
      <button
        type="button"
        onClick={() => requireSignIn("fund")}
        className="mt-2 min-h-11 w-full rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-300/[0.09]"
      >
        Review funding
      </button>
      {canManage && providers.length > 0 && (
        <button
          type="button"
          onClick={() => setPanel("provider")}
          className="mt-2 min-h-11 w-full rounded-xl border border-white/10 px-4 text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
        >
          Choose provider
        </button>
      )}
      {!signedIn && (
        <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
          Browse freely. Sign in is requested only when you act.
        </p>
      )}

      {panel && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="action-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#081321] p-5 sm:rounded-[28px] sm:p-6">
            <div className="flex items-center justify-between">
              <h2 id="action-title" className="text-xl font-semibold text-white">
                {panel === "apply"
                  ? "Apply for this opportunity"
                  : panel === "provider"
                    ? "Choose a provider"
                    : "Review funding"}
              </h2>
              <button type="button" aria-label="Close" onClick={() => setPanel(null)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            {panel === "apply" && (
              <div className="mt-5">
                <label className="block text-sm text-slate-300">
                  Proposal
                  <textarea
                    value={proposal}
                    onChange={(event) => setProposal(event.target.value)}
                    rows={7}
                    placeholder="Explain how you will deliver the required outcome and evidence."
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#050d18] p-3 text-sm text-white outline-none focus:border-violet-400"
                  />
                </label>
                <label className="mt-4 block text-sm text-slate-300">
                  Public evidence links, one per line
                  <textarea
                    value={evidence}
                    onChange={(event) => setEvidence(event.target.value)}
                    rows={3}
                    placeholder="https://..."
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#050d18] p-3 text-sm text-white outline-none focus:border-violet-400"
                  />
                </label>
                <p className="mt-3 text-xs text-slate-500">Your draft remains in this form if submission fails.</p>
                <button type="button" onClick={apply} disabled={busy === "apply" || proposal.trim().length < 40} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 text-sm font-semibold text-white disabled:opacity-40">
                  {busy === "apply" && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Submit application
                </button>
              </div>
            )}

            {panel === "provider" && (
              <div className="mt-5">
                <label className="block text-sm text-slate-300">
                  Verified person or agent
                  <select value={providerId} onChange={(event) => setProviderId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#050d18] px-3 text-sm text-white">
                    <option value="">Choose provider</option>
                    {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.kind}</option>)}
                  </select>
                </label>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => selectProvider("preferred")} disabled={!providerId || busy === "provider"} className="min-h-11 rounded-xl border border-violet-300/20 bg-violet-300/[0.05] text-sm font-semibold text-violet-200 disabled:opacity-40">
                    Mark preferred
                  </button>
                  <button type="button" onClick={() => selectProvider("selected")} disabled={!providerId || busy === "provider"} className="min-h-11 rounded-xl bg-violet-500 text-sm font-semibold text-white disabled:opacity-40">
                    Select provider
                  </button>
                </div>
              </div>
            )}

            {panel === "fund" && (
              <div className="mt-5">
                <fieldset>
                  <legend className="text-sm font-medium text-slate-300">Funding path</legend>
                  <div className="mt-3 grid gap-2">
                    {[
                      { id: "outcome", label: "Fund the outcome", detail: "Funds follow this opportunity's evidence and release rules." },
                      { id: "selected_provider", label: "Fund a selected person or agent", detail: "Reserve the reward for one verified provider." },
                      { id: "sponsorship", label: "Sponsor a person directly", detail: "No delivery obligation. This is clearly separate from task funding." },
                    ].map((mode) => (
                      <label key={mode.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${fundingMode === mode.id ? "border-violet-300/30 bg-violet-300/[0.06]" : "border-white/10"}`}>
                        <input type="radio" name="funding-mode" value={mode.id} checked={fundingMode === mode.id} onChange={() => { setFundingMode(mode.id as FundingReview["mode"]); setReview(null); }} className="mt-1 accent-violet-500" />
                        <span><span className="block text-sm font-medium text-white">{mode.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{mode.detail}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {fundingMode !== "outcome" && (
                  <label className="mt-4 block text-sm text-slate-300">
                    Verified recipient
                    <select value={providerId} onChange={(event) => { setProviderId(event.target.value); setReview(null); }} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#050d18] px-3 text-sm text-white">
                      <option value="">Choose person or agent</option>
                      {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.kind}</option>)}
                    </select>
                  </label>
                )}
                <label className="mt-4 block text-sm text-slate-300">
                  Amount in USD
                  <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); setReview(null); }} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#050d18] px-3 text-sm text-white" />
                </label>
                <button type="button" onClick={buildFundingReview} disabled={busy === "fund" || !Number(amount) || (fundingMode !== "outcome" && !providerId)} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 text-sm font-semibold text-white disabled:opacity-40">
                  {busy === "fund" && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Build dry-run review
                </button>
                {review && (
                  <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.035] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Funding distribution review</div>
                    {review.reservationNotice && <p className="mt-3 rounded-lg bg-violet-300/[0.06] p-3 text-xs leading-5 text-violet-100">{review.reservationNotice}</p>}
                    <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                      <div><dt className="text-slate-600">Recipient</dt><dd className="mt-1 text-white">{review.recipient}</dd></div>
                      <div><dt className="text-slate-600">Amount</dt><dd className="mt-1 text-white">${review.amountUsd.toLocaleString()} {review.token}</dd></div>
                      <div><dt className="text-slate-600">Network</dt><dd className="mt-1 text-white">{review.network}</dd></div>
                      <div><dt className="text-slate-600">Delivery obligation</dt><dd className="mt-1 text-white">{review.createsDeliveryObligation ? "Yes" : "No"}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-slate-600">Release condition</dt><dd className="mt-1 leading-5 text-slate-300">{review.releaseCondition}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-slate-600">Refund condition</dt><dd className="mt-1 leading-5 text-slate-300">{review.refundCondition}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-slate-600">Fees</dt><dd className="mt-1 leading-5 text-slate-300">{review.fees.message}</dd></div>
                    </dl>
                    <div className="mt-4 flex gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{review.blocker}</div>
                    <button type="button" disabled className="mt-4 min-h-11 w-full rounded-xl bg-slate-700 text-sm font-semibold text-slate-400">Transaction disabled in Discover</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
