"use client";

import { useEffect, useRef, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { toast } from "sonner";

type Step = "choose" | "verify";

export function SignInModal() {
  const { open, closeSignIn } = useSignInModal();
  const { signInWithGoogle, signInWithEmail, verifyEmailOtp, resendEmailCode, user } =
    useAuth();
  const { open: openWallet } = useAppKit();
  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState<
    "google" | "email" | "verify" | "resend" | "wallet" | null
  >(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const EMAIL_KEY = "resolve.signin.email";

  useEffect(() => {
    if (!open) {
      setStep("choose");
      setCode("");
      setLoading(null);
      return;
    }
    try {
      const saved = localStorage.getItem(EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    if (step === "verify") codeInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (user && open) closeSignIn();
  }, [user, open, closeSignIn]);

  if (!open) return null;

  async function handleGoogle() {
    setLoading("google");
    try {
      await signInWithGoogle();
    } finally {
      setLoading(null);
    }
  }

  function handleWallet() {
    setLoading("wallet");
    try {
      openWallet({ view: "Connect" });
    } finally {
      setLoading(null);
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email");
      return;
    }
    setLoading("email");
    try {
      const trimmed = email.trim();
      localStorage.setItem(EMAIL_KEY, trimmed);
      await signInWithEmail(trimmed);
      setStep("verify");
    } catch {
      /* toast shown in provider */
    } finally {
      setLoading(null);
    }
  }

  async function handleResend() {
    if (!email.trim()) return;
    setLoading("resend");
    try {
      await resendEmailCode(email.trim());
    } finally {
      setLoading(null);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.replace(/\s/g, "").length < 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setLoading("verify");
    try {
      const ok = await verifyEmailOtp(email.trim(), code);
      if (ok) closeSignIn();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c1219] to-[#05080c] p-6 shadow-2xl shadow-black/40"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-400">
              RESOLVE
            </p>
            <h2 id="sign-in-title" className="mt-1 text-xl font-semibold text-white">
              {step === "verify" ? "Check your email" : "Sign in"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {step === "verify"
                ? `Enter the 6-digit code we sent to ${email}`
                : "Google, wallet, or email."}
            </p>
          </div>
          <button
            type="button"
            onClick={closeSignIn}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {step === "choose" && (
          <div className="mt-6 space-y-4">
            <button
              type="button"
              disabled={loading !== null}
              onClick={handleGoogle}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white py-3.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <GoogleIcon />
              {loading === "google" ? "Redirecting…" : "Continue with Google"}
            </button>

            <button
              type="button"
              disabled={loading !== null}
              onClick={handleWallet}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 py-3.5 text-sm font-medium text-white transition hover:border-sky-500/40 hover:bg-white/5 disabled:opacity-50"
            >
              <Wallet className="h-4 w-4 text-sky-400" />
              {loading === "wallet" ? "Opening wallet…" : "Connect wallet"}
            </button>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="h-px flex-1 bg-white/10" />
              or
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleSendCode} className="space-y-3">
              <label className="block text-xs font-medium text-slate-400">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500/50"
              />
              <button
                type="submit"
                disabled={loading !== null}
                className="w-full rounded-xl bg-sky-500 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
              >
                {loading === "email" ? "Sending code…" : "Send login code"}
              </button>
            </form>
          </div>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))
              }
              placeholder="000000"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-center font-mono text-2xl tracking-[0.4em] text-white outline-none focus:border-sky-500/50"
            />
            <button
              type="submit"
              disabled={loading !== null || code.length < 6}
              className="w-full rounded-xl bg-sky-500 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading === "verify" ? "Verifying…" : "Continue"}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep("choose");
                  setCode("");
                }}
                className="text-slate-500 underline hover:text-white"
              >
                Change email
              </button>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void handleResend()}
                className="text-sky-400 hover:text-sky-300 disabled:opacity-50"
              >
                {loading === "resend" ? "Sending…" : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
