"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import { Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { WalletAuthEffect } from "@/components/wallet/wallet-auth-effect";

type Step = "choose" | "sent";
type AuthAction = "google" | "email" | "wallet" | null;

const COOLDOWN_KEY = "resolve.signin.cooldownUntil";
const EMAIL_KEY = "resolve.signin.email";

function getCooldownRemaining(): number {
  try {
    const until = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0);
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function SignInModal() {
  const { open, closeSignIn } = useSignInModal();
  const { signInWithGoogle, signInWithEmail, supabaseConfigured } = useAuth();
  const account = useResolveAccount();
  const { open: openWallet } = useAppKit();
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [authAction, setAuthAction] = useState<AuthAction>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleWalletTimeout = useCallback(() => {
    setInlineError(
      "Wallet request timed out. Please approve in your wallet or try again."
    );
  }, []);

  useEffect(() => {
    if (!open) {
      setStep("choose");
      setAuthAction(null);
      setWalletConnecting(false);
      setInlineError(null);
      return;
    }
    try {
      const saved = localStorage.getItem(EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
    setCooldown(getCooldownRemaining());
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      return;
    }
    cooldownRef.current = setInterval(() => {
      const remaining = getCooldownRemaining();
      setCooldown(remaining);
      if (remaining <= 0 && cooldownRef.current) {
        clearInterval(cooldownRef.current);
      }
    }, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown]);

  useEffect(() => {
    if (open && account.isAuthenticated) closeSignIn();
  }, [account.isAuthenticated, open, closeSignIn]);

  useEffect(() => {
    if (open && isConnected && address) {
      setWalletConnecting(false);
      setAuthAction(null);
      closeSignIn();
    }
  }, [open, isConnected, address, closeSignIn]);

  if (!open) return null;

  async function handleGoogle() {
    setInlineError(null);
    if (!supabaseConfigured) {
      setInlineError(
        process.env.NODE_ENV === "development"
          ? "Authentication is not configured. Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
          : "Sign-in is temporarily unavailable."
      );
      return;
    }
    setAuthAction("google");
    try {
      await signInWithGoogle();
    } catch {
      setInlineError("Could not start Google sign-in. Try again.");
    } finally {
      setAuthAction(null);
    }
  }

  function handleWallet() {
    setInlineError(null);
    setAuthAction("wallet");
    setWalletConnecting(true);
    openWallet({ view: "Connect" });
    setAuthAction(null);
  }

  async function handleSendMagicLink(e?: React.FormEvent) {
    e?.preventDefault();
    setInlineError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setInlineError("Enter your email address.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setInlineError("Enter a valid email address.");
      return;
    }
    if (cooldown > 0) return;

    setAuthAction("email");
    try {
      localStorage.setItem(EMAIL_KEY, trimmed);
      const result = await signInWithEmail(trimmed);

      if (!result.ok) {
        if (result.cooldownSeconds) {
          const until = Date.now() + result.cooldownSeconds * 1000;
          localStorage.setItem(COOLDOWN_KEY, String(until));
          setCooldown(result.cooldownSeconds);
          setStep("sent");
        }
        setInlineError(result.message);
        return;
      }

      const until = Date.now() + 60_000;
      localStorage.setItem(COOLDOWN_KEY, String(until));
      setCooldown(60);
      setStep("sent");
    } finally {
      setAuthAction(null);
    }
  }

  const emailReady = isValidEmail(email);
  const googleDisabled = authAction === "google";
  const walletDisabled = authAction === "wallet" || walletConnecting;
  const emailDisabled =
    authAction === "email" || cooldown > 0 || !supabaseConfigured || !emailReady;

  return (
    <>
      <WalletAuthEffect
        walletConnecting={walletConnecting}
        onWalletConnectingChange={setWalletConnecting}
        onWalletTimeout={handleWalletTimeout}
      />
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
                {step === "sent" ? "Check your email" : "Sign in"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {step === "sent"
                  ? `Magic link sent to ${email}. Check your inbox.`
                  : "Choose how RESOLVE should remember your tasks."}
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
              <div>
                <button
                  type="button"
                  disabled={googleDisabled}
                  onClick={() => void handleGoogle()}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white py-3.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <GoogleIcon />
                  {authAction === "google" ? "Redirecting…" : "Continue with Google"}
                </button>
              </div>

              <div>
                <button
                  type="button"
                  disabled={walletDisabled}
                  onClick={handleWallet}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 py-3.5 text-sm font-medium text-white transition hover:border-sky-500/40 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Wallet className="h-4 w-4 text-sky-400" />
                  {walletConnecting
                    ? "Waiting for wallet…"
                    : authAction === "wallet"
                      ? "Opening wallet…"
                      : "Connect wallet"}
                </button>
                {walletConnecting && (
                  <p className="mt-2 text-xs text-slate-500">
                    Approve the connection in your wallet extension.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="h-px flex-1 bg-white/10" />
                or
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={handleSendMagicLink} className="space-y-3">
                <label className="block text-xs font-medium text-slate-400">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setInlineError(null);
                  }}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500/50"
                />
                <button
                  type="submit"
                  disabled={emailDisabled}
                  className="w-full rounded-xl bg-sky-500 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {authAction === "email"
                    ? "Sending…"
                    : cooldown > 0
                      ? `Try again in ${cooldown}s`
                      : "Send magic link"}
                </button>
              </form>

              {inlineError && (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {inlineError}
                </p>
              )}

              {!supabaseConfigured && process.env.NODE_ENV === "development" && (
                <p className="text-xs text-amber-400/90">
                  Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.
                </p>
              )}
            </div>
          )}

          {step === "sent" && (
            <div className="mt-6 space-y-4">
              <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300">
                Magic link sent. Open the email and tap the sign-in link. This page
                will update when you return.
              </p>
              {inlineError && (
                <p className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                  {inlineError}
                </p>
              )}
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("choose");
                    setInlineError(null);
                  }}
                  className="text-slate-500 underline hover:text-white"
                >
                  Change email
                </button>
                <button
                  type="button"
                  disabled={authAction === "email" || cooldown > 0}
                  onClick={() => void handleSendMagicLink()}
                  className="text-sky-400 hover:text-sky-300 disabled:opacity-50"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
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
