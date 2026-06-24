"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import { ArrowLeft, Wallet } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { WalletAuthEffect } from "@/components/wallet/wallet-auth-effect";
import { OtpInput } from "@/components/auth/otp-input";
import { enableGuestExploring } from "@/lib/auth/guest";
import {
  detectInjectedWallets,
  walletConnectorAvailable,
} from "@/lib/wallet/detect";

type Step = "welcome" | "otp" | "magic-sent" | "wallet-picker";
type AuthAction = "google" | "email" | "wallet" | "verify" | null;

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
  const {
    signInWithGoogle,
    sendLoginCode,
    signInWithEmail,
    verifyEmailOtp,
    provisionWallet,
    supabaseConfigured,
  } = useAuth();
  const account = useResolveAccount();
  const { open: openWallet } = useAppKit();
  const { address, isConnected } = useAccount();

  const [step, setStep] = useState<Step>("welcome");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [authAction, setAuthAction] = useState<AuthAction>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<{
    google?: string;
    email?: string;
    wallet?: string;
  }>({});
  const [walletPending, setWalletPending] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const walletAvailable = walletConnectorAvailable();
  const injectedWallets = detectInjectedWallets();

  const handleWalletTimeout = useCallback(() => {
    setMethodError((prev) => ({
      ...prev,
      wallet:
        "Wallet request timed out. Open your wallet and try again.",
    }));
  }, []);

  useEffect(() => {
    if (!open) {
      setStep("welcome");
      setAuthAction(null);
      setWalletConnecting(false);
      setInlineError(null);
      setMethodError({});
      setOtp("");
      setWalletPending(false);
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
    setMethodError((prev) => ({ ...prev, google: undefined }));
    if (!supabaseConfigured) {
      setMethodError((prev) => ({
        ...prev,
        google:
          process.env.NODE_ENV === "development"
            ? "Google sign-in needs NEXT_PUBLIC_SUPABASE_URL and anon key."
            : "Google sign-in is temporarily unavailable.",
      }));
      return;
    }
    setAuthAction("google");
    try {
      await signInWithGoogle();
    } catch {
      setMethodError((prev) => ({
        ...prev,
        google: "Google sign-in needs OAuth redirect setup.",
      }));
    } finally {
      setAuthAction(null);
    }
  }

  function handleOpenWalletPicker() {
    setMethodError((prev) => ({ ...prev, wallet: undefined }));
    if (!walletAvailable) {
      setMethodError((prev) => ({
        ...prev,
        wallet: "Wallet connector is not configured.",
      }));
      return;
    }
    setStep("wallet-picker");
  }

  function handleConnectWallet() {
    setMethodError((prev) => ({ ...prev, wallet: undefined }));
    setAuthAction("wallet");
    setWalletConnecting(true);
    openWallet({ view: "Connect" });
    setAuthAction(null);
  }

  async function handleEmailContinue(e?: React.FormEvent) {
    e?.preventDefault();
    setInlineError(null);
    setMethodError((prev) => ({ ...prev, email: undefined }));

    const trimmed = email.trim();
    if (!trimmed) {
      setInlineError("Enter your email address.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setInlineError("Enter a valid email address.");
      return;
    }
    if (cooldown > 0) {
      setMethodError((prev) => ({
        ...prev,
        email: `Code already sent. Try again in ${cooldown} seconds.`,
      }));
      return;
    }

    if (!supabaseConfigured) {
      setMethodError((prev) => ({
        ...prev,
        email: "Email sign-in is temporarily unavailable. You can still connect a wallet.",
      }));
      return;
    }

    setAuthAction("email");
    try {
      localStorage.setItem(EMAIL_KEY, trimmed);
      const result = await sendLoginCode(trimmed);

      if (!result.ok) {
        if (result.cooldownSeconds) {
          const until = Date.now() + result.cooldownSeconds * 1000;
          localStorage.setItem(COOLDOWN_KEY, String(until));
          setCooldown(result.cooldownSeconds);
        }
        setMethodError((prev) => ({ ...prev, email: result.message }));
        return;
      }

      const until = Date.now() + 60_000;
      localStorage.setItem(COOLDOWN_KEY, String(until));
      setCooldown(60);

      if (result.method === "magic_link") {
        setStep("magic-sent");
      } else {
        setStep("otp");
      }
    } finally {
      setAuthAction(null);
    }
  }

  async function handleResendMagicLink() {
    if (cooldown > 0 || authAction === "email") return;
    setAuthAction("email");
    try {
      const result = await signInWithEmail(email.trim());
      if (!result.ok) {
        if (result.cooldownSeconds) {
          const until = Date.now() + result.cooldownSeconds * 1000;
          localStorage.setItem(COOLDOWN_KEY, String(until));
          setCooldown(result.cooldownSeconds);
        }
        setMethodError((prev) => ({ ...prev, email: result.message }));
        return;
      }
      const until = Date.now() + 60_000;
      localStorage.setItem(COOLDOWN_KEY, String(until));
      setCooldown(60);
    } finally {
      setAuthAction(null);
    }
  }

  async function handleVerifyOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setInlineError(null);

    if (otp.replace(/\s/g, "").length < 6) {
      setInlineError("Enter the 6-digit code.");
      return;
    }

    setAuthAction("verify");
    try {
      const result = await verifyEmailOtp(email.trim(), otp);
      if (!result.ok) {
        setInlineError(result.message);
        return;
      }
      if (result.walletPending) {
        setWalletPending(true);
      } else {
        closeSignIn();
        window.location.href = "/start";
      }
    } finally {
      setAuthAction(null);
    }
  }

  async function handleRetryWallet() {
    setAuthAction("verify");
    try {
      await provisionWallet();
      setWalletPending(false);
      closeSignIn();
      window.location.href = "/start";
    } catch {
      setInlineError("App wallet setup needs retry.");
    } finally {
      setAuthAction(null);
    }
  }

  function handleGuestContinue() {
    enableGuestExploring();
    closeSignIn();
  }

  const emailReady = isValidEmail(email);
  const googleDisabled = authAction === "google" || !supabaseConfigured;
  const walletDisabled = authAction === "wallet" || walletConnecting;
  const emailDisabled =
    !emailReady ||
    authAction === "email" ||
    cooldown > 0 ||
    !supabaseConfigured;

  return (
    <>
      <WalletAuthEffect
        walletConnecting={walletConnecting}
        onWalletConnectingChange={setWalletConnecting}
        onWalletTimeout={handleWalletTimeout}
      />
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
        <div
          className="w-full max-w-[480px] rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c1219] to-[#05080c] p-6 shadow-2xl shadow-black/40 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sign-in-title"
        >
          {step === "wallet-picker" && (
            <button
              type="button"
              onClick={() => setStep("welcome")}
              className="mb-4 flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}

          {step === "otp" && (
            <button
              type="button"
              onClick={() => {
                setStep("welcome");
                setOtp("");
                setInlineError(null);
              }}
              className="mb-4 flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-400">
                RESOLVE
              </p>
              <h2 id="sign-in-title" className="mt-1 text-2xl font-semibold text-white">
                {step === "otp"
                  ? "Enter your code"
                  : step === "magic-sent"
                    ? "Check your email"
                    : step === "wallet-picker"
                      ? "Choose wallet"
                      : "Welcome"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {step === "otp"
                  ? `We sent a login code to ${email}`
                  : step === "magic-sent"
                    ? `We sent a secure sign-in link to ${email}.`
                    : step === "wallet-picker"
                      ? "Pick the wallet you want to connect."
                      : "Enter your email or connect a wallet to get started."}
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

          {step === "welcome" && (
            <div className="mt-6 space-y-5">
              <form onSubmit={handleEmailContinue} className="space-y-3">
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
                      : "Continue"}
                </button>
                {methodError.email && (
                  <p className="text-xs text-amber-200">{methodError.email}</p>
                )}
                {inlineError && (
                  <p className="text-xs text-amber-200">{inlineError}</p>
                )}
              </form>

              <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <span className="h-px flex-1 bg-white/10" />
                Or continue with
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  disabled={googleDisabled}
                  onClick={() => void handleGoogle()}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white py-3.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <GoogleIcon />
                  {authAction === "google" ? "Redirecting…" : "Continue with Google"}
                </button>
                {methodError.google && (
                  <p className="text-xs text-amber-200">{methodError.google}</p>
                )}

                <button
                  type="button"
                  disabled={walletDisabled || !walletAvailable}
                  onClick={handleOpenWalletPicker}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 py-3.5 text-sm font-medium text-white transition hover:border-sky-500/40 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Wallet className="h-4 w-4 text-sky-400" />
                  {walletConnecting ? "Waiting for wallet…" : "Continue with wallet"}
                </button>
                {methodError.wallet && (
                  <p className="text-xs text-amber-200">{methodError.wallet}</p>
                )}
              </div>

              {!supabaseConfigured && (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {process.env.NODE_ENV === "development"
                    ? "Email and Google sign-in are unavailable. Wallet sign-in still works."
                    : "Email and Google sign-in are temporarily unavailable. Wallet sign-in still works."}
                </p>
              )}

              <button
                type="button"
                onClick={handleGuestContinue}
                className="w-full text-center text-xs text-slate-500 underline hover:text-slate-300"
              >
                Continue without sign-in
              </button>
            </div>
          )}

          {step === "wallet-picker" && (
            <div className="mt-6 space-y-3">
              {injectedWallets.length > 0 ? (
                injectedWallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    disabled={walletDisabled}
                    onClick={handleConnectWallet}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 py-3.5 text-sm font-medium text-white transition hover:border-sky-500/40 hover:bg-white/5 disabled:opacity-60"
                  >
                    <Wallet className="h-4 w-4 text-sky-400" />
                    Connect {w.label} Wallet
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  disabled={walletDisabled}
                  onClick={handleConnectWallet}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 py-3.5 text-sm font-medium text-white transition hover:border-sky-500/40 hover:bg-white/5 disabled:opacity-60"
                >
                  <Wallet className="h-4 w-4 text-sky-400" />
                  Connect wallet
                </button>
              )}
              {walletAvailable && (
                <button
                  type="button"
                  disabled={walletDisabled}
                  onClick={handleConnectWallet}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 py-3.5 text-sm font-medium text-white transition hover:border-sky-500/40 hover:bg-white/5 disabled:opacity-60"
                >
                  WalletConnect
                </button>
              )}
              {walletConnecting && (
                <p className="text-xs text-slate-500">
                  Approve the connection in your wallet extension.
                </p>
              )}
              {methodError.wallet && (
                <p className="text-xs text-amber-200">{methodError.wallet}</p>
              )}
            </div>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-5">
              <OtpInput
                value={otp}
                onChange={setOtp}
                disabled={authAction === "verify"}
                error={Boolean(inlineError)}
              />
              {inlineError && (
                <p className="text-center text-xs text-amber-200">{inlineError}</p>
              )}
              {walletPending ? (
                <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-sm text-slate-300">
                    Account created. App wallet setup needs retry.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleRetryWallet()}
                    disabled={authAction === "verify"}
                    className="w-full rounded-xl bg-sky-500 py-3 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
                  >
                    Retry wallet setup
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={authAction === "verify" || otp.length < 6}
                  className="w-full rounded-xl bg-sky-500 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {authAction === "verify" ? "Verifying…" : "Continue"}
                </button>
              )}
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("welcome");
                    setOtp("");
                  }}
                  className="text-slate-500 underline hover:text-white"
                >
                  Change email
                </button>
                <button
                  type="button"
                  disabled={authAction === "email" || cooldown > 0}
                  onClick={() => void handleEmailContinue()}
                  className="text-sky-400 hover:text-sky-300 disabled:opacity-50"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {step === "magic-sent" && (
            <div className="mt-6 space-y-4">
              <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300">
                Magic link sent. Open the email and tap the sign-in link.
              </p>
              {methodError.email && (
                <p className="text-xs text-sky-200">{methodError.email}</p>
              )}
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("welcome");
                    setMethodError({});
                  }}
                  className="text-slate-500 underline hover:text-white"
                >
                  Change email
                </button>
                <button
                  type="button"
                  disabled={authAction === "email" || cooldown > 0}
                  onClick={() => void handleResendMagicLink()}
                  className="text-sky-400 hover:text-sky-300 disabled:opacity-50"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
                </button>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-[10px] leading-relaxed text-slate-500">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-slate-300">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-slate-300">
              Privacy Policy
            </Link>
            .
          </p>
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
