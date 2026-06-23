"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Step = "account" | "cancel" | "claim" | "confirmation";

function confirmationId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

export function StreamlyPortal() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "claim" ? "claim" : "cancel";
  const [step, setStep] = useState<Step>(mode === "claim" ? "claim" : "account");
  const [email, setEmail] = useState("demo@resolve.app");
  const [reason, setReason] = useState("No longer using the service");
  const [claimAmount, setClaimAmount] = useState("43.00");
  const [confId, setConfId] = useState("");

  const confirmationCopy = useMemo(() => {
    if (mode === "claim") {
      return `Claim submitted successfully. Reference ${confId}. Refund of $${claimAmount} is being processed.`;
    }
    return `Subscription cancelled. Confirmation ${confId}. Billing stops at the end of this cycle.`;
  }, [mode, confId, claimAmount]);

  function submitCancel() {
    setConfId(confirmationId("SUB"));
    setStep("confirmation");
  }

  function submitClaim() {
    setConfId(confirmationId("TKT"));
    setStep("confirmation");
  }

  return (
    <div className="min-h-screen bg-[#0c1018] text-slate-100">
      <header className="border-b border-white/10 bg-[#121826] px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-violet-300">
              Demo portal
            </p>
            <h1 className="text-2xl font-semibold">Streamly Plus</h1>
          </div>
          <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs text-violet-200">
            RESOLVE judge demo
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {step === "account" && (
          <section data-testid="streamly-account" className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[#151c2c] p-6">
              <h2 className="text-lg font-medium">Your account</h2>
              <p className="mt-1 text-sm text-slate-400">
                Streamly Plus · $12.99 / month · renews monthly
              </p>
              <label className="mt-6 block text-sm text-slate-300">
                Account email
                <input
                  data-testid="account-email"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-[#0c1018] px-3 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button
                type="button"
                data-testid="cancel-start"
                onClick={() => setStep("cancel")}
                className="mt-6 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Cancel subscription
              </button>
            </div>
          </section>
        )}

        {step === "cancel" && (
          <section data-testid="cancel-form" className="space-y-4">
            <h2 className="text-lg font-medium">Cancel Streamly Plus</h2>
            <p className="text-sm text-slate-400">
              Tell us why you are leaving. This demo portal is used by RESOLVE
              Playwright proof capture.
            </p>
            <label className="block text-sm">
              Reason
              <textarea
                data-testid="cancel-reason"
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#151c2c] px-3 py-2"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button
              type="button"
              data-testid="cancel-submit"
              data-action="final-submit"
              onClick={submitCancel}
              className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Confirm cancellation
            </button>
          </section>
        )}

        {step === "claim" && (
          <section data-testid="claim-form" className="space-y-4">
            <h2 className="text-lg font-medium">Submit refund claim</h2>
            <label className="block text-sm">
              Account email
              <input
                data-testid="account-email"
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#151c2c] px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Refund amount (USD)
              <input
                data-testid="claim-amount"
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#151c2c] px-3 py-2"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
              />
            </label>
            <button
              type="button"
              data-testid="claim-submit"
              data-action="final-submit"
              onClick={submitClaim}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Submit claim
            </button>
          </section>
        )}

        {step === "confirmation" && (
          <section
            data-testid="streamly-confirmation"
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6"
          >
            <h2 className="text-lg font-semibold text-emerald-300">
              {mode === "claim"
                ? "Claim submitted"
                : "Subscription cancelled"}
            </h2>
            <p
              data-proof="confirmation"
              className="mt-3 text-sm leading-relaxed text-slate-200"
            >
              {confirmationCopy}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
