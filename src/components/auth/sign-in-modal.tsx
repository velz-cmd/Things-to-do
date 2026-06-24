"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useConnect } from "wagmi";
import { ArrowLeft, Wallet } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { WalletAuthEffect } from "@/components/wallet/wallet-auth-effect";
import { OtpInput } from "@/components/auth/otp-input";
import { enableGuestExploring } from "@/lib/auth/guest";
import { getRememberedEmail } from "@/lib/auth/remember";
import { detectInjectedWallets } from "@/lib/wallet/detect";

type Step = "welcome" | "otp" | "magic-sent" | "wallet-picker";
type AuthAction = "email" | "google" | "wallet" | "verify" | "guest" | null;

const COOLDOWN_KEY = "resolve.signin.cooldownUntil";
const EMAIL_KEY = "resolve.signin.email";
const SENT_STEP_KEY = "resolve.signin.sentStep";

function getCooldownRemaining(): number {
  try {
    const until = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0);
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

function setCooldownSeconds(seconds: number) {
  try {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now() + seconds * 1000));
  } catch {
    /* ignore */
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function SignInModal() {
  const { open, closeSignIn } = useSignInModal();
  const {
    sendLoginCode,
    signInWithGoogle,
    verifyEmailOtp,
    provisionWallet,
    emailEnabled,
    googleEnabled,
  } = useAuth();
  const capabilities = useAuthCapabilities();
  const account = useResolveAccount();
  const { open: openWallet, close: closeWallet } = useAppKit();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();

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

  const showEmail = emailEnabled;
  const showGoogle = capabilities.loaded && googleEnabled;
  const showWallet = true;
  const showDivider = showEmail && (showGoogle || showWallet);
  const injectedWallets = detectInjectedWallets();

  const handleWalletTimeout = useCallback(() => {
    setWalletConnecting(false);
    setAuthAction(null);
    setMethodError((prev) => ({
      ...prev,
      wallet: "Wallet request timed out. Open your wallet and try again.",
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

    let savedEmail = "";
    try {
      savedEmail =
        localStorage.getItem(EMAIL_KEY) ??
        getRememberedEmail() ??
        "";
      if (savedEmail) setEmail(savedEmail);
    } catch {
      /* ignore */
    }

    const remaining = getCooldownRemaining();
    setCooldown(remaining);

    if (cooldown > 0 && savedEmail) {
      try {
        const sentStep = localStorage.getItem(SENT_STEP_KEY) as Step | null;
        setStep(sentStep === "otp" ? "otp" : "magic-sent");
      } catch {
        setStep("magic-sent");
      }
    }
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      return;
    }
    cooldownRef.current = setInterval(() => {
      setCooldown(getCooldownRemaining());
    }, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown]);

  useEffect(() => {
    if (open && account.isAuthenticated) {
      setWalletConnecting(false);
      void closeWallet();
      closeSignIn();
    }
  }, [account.isAuthenticated, open, closeSignIn, closeWallet]);

  useEffect(() => {
    if (!open || !isConnected || !address) return;
    setWalletConnecting(false);
    setAuthAction(null);
    void closeWallet();
    closeSignIn();
  }, [open, isConnected, address, closeSignIn, closeWallet]);

  if (!open) return null;

  function goToSentStep(method: "otp" | "magic_link") {
    const nextStep: Step = method === "otp" ? "otp" : "magic-sent";
    setStep(nextStep);
    try {
      localStorage.setItem(SENT_STEP_KEY, nextStep);
    } catch {
      /* ignore */
    }
    setCooldownSeconds(60);
    setCooldown(60);
    setMethodError((prev) => ({ ...prev, email: undefined }));
  }

  async function handleGoogle() {
    setMethodError((prev) => ({ ...prev, google: undefined }));
    setAuthAction("google");
    try {
      await signInWithGoogle();
    } catch {
      setMethodError((prev) => ({
        ...prev,
        google: "Google sign-in needs OAuth redirect setup.",
      }));
      setAuthAction(null);
    }
  }

  function handleOpenWalletPicker() {
    setMethodError((prev) => ({ ...prev, wallet: undefined }));
    setStep("wallet-picker");
  }

  function connectInjected() {
    const injected =
      connectors.find((c) => c.id === "injected") ??
      connectors.find((c) => c.type === "injected") ??
      connectors[0];
    if (!injected) {
      openWallet({ view: "Connect" });
      return;
    }
    connect({ connector: injected });
  }

  function handleConnectWallet() {
    setMethodError((prev) => ({ ...prev, wallet: undefined }));
    setAuthAction("wallet");
    setWalletConnecting(true);
    const hasInjected = injectedWallets.length > 0;
    if (hasInjected) {
      connectInjected();
    } else {
      openWallet({ view: "Connect" });
    }
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
      const priorStep =
        (localStorage.getItem(SENT_STEP_KEY) as "otp" | "magic-sent" | null) ??
        "magic_link";
      setMethodError((prev) => ({
        ...prev,
        email: `Sign-in already sent. Resend in ${cooldown}s.`,
      }));
      goToSentStep(priorStep === "otp" ? "otp" : "magic_link");
      return;
    }

    setAuthAction("email");
    try {
      localStorage.setItem(EMAIL_KEY, trimmed);
      const result = await sendLoginCode(trimmed, { method: "magic_link" });

      if (!result.ok) {
        if (result.cooldownSeconds) {
          setCooldownSeconds(result.cooldownSeconds);
          setCooldown(result.cooldownSeconds);
        }
        setMethodError((prev) => ({ ...prev, email: result.message }));
        return;
      }

      goToSentStep(result.method ?? "magic_link");
    } finally {
      setAuthAction(null);
    }
  }

  async function handleResend(method: "otp" | "magic_link" = "magic_link") {
    if (cooldown > 0 || authAction === "email") return;
    setAuthAction("email");
    setMethodError((prev) => ({ ...prev, email: undefined }));
    setInlineError(null);
    try {
      const result = await sendLoginCode(email.trim(), { method });
      if (!result.ok) {
        if (result.cooldownSeconds) {
          setCooldownSeconds(result.cooldownSeconds);
          setCooldown(result.cooldownSeconds);
        }
        setMethodError((prev) => ({
          ...prev,
          email: result.message,
        }));
        return;
      }
      goToSentStep(result.method ?? method);
    } finally {
      setAuthAction(null);
    }
  }

  async function handleSwitchToOtp() {
    setInlineError(null);
    setMethodError((prev) => ({ ...prev, email: undefined }));
    setStep("otp");
    try {
      localStorage.setItem(SENT_STEP_KEY, "otp");
    } catch {
      /* ignore */
    }

    if (cooldown > 0) {
      setInlineError(`Resend a code in ${cooldown}s, or use the magic link email.`);
      return;
    }

    setAuthAction("email");
    try {
      const result = await sendLoginCode(email.trim(), { method: "otp" });
      if (!result.ok) {
        if (result.cooldownSeconds) {
          setCooldownSeconds(result.cooldownSeconds);
          setCooldown(result.cooldownSeconds);
        }
        setInlineError(result.message);
        return;
      }
      goToSentStep("otp");
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
    setAuthAction("guest");
    enableGuestExploring();
    closeSignIn();
    setAuthAction(null);
  }

  const subtitle =
    step === "wallet-picker"
      ? "Pick the wallet you want to connect."
      : step === "otp"
        ? `Enter the code sent to ${email}`
        : step === "magic-sent"
          ? `Check your inbox at ${email}`
          : showEmail && showWallet
            ? "Enter your email or connect a wallet to get started."
            : showWallet
              ? "Connect a wallet to get started."
              : "Enter your email to get started.";

  const emailReady = isValidEmail(email);
  const walletBusy =
    authAction === "wallet" || walletConnecting || connectPending;

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
          {(step === "wallet-picker" || step === "otp" || step === "magic-sent") && (
            <button
              type="button"
              onClick={() => {
                setStep("welcome");
                setOtp("");
                setInlineError(null);
                setMethodError({});
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
                      : getRememberedEmail() && email
                        ? "Welcome back"
                        : "Welcome"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p>
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
              {showEmail && (
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
                    disabled={authAction === "email" || !emailReady}
                    className="w-full rounded-xl bg-sky-500 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {authAction === "email"
                      ? "Sending…"
                      : cooldown > 0
                        ? "Check your email"
                        : "Continue"}
                  </button>
                  {inlineError && (
                    <p className="text-xs text-amber-200">{inlineError}</p>
                  )}
                </form>
              )}

              {showDivider && (
                <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <span className="h-px flex-1 bg-white/10" />
                  Or continue with
                  <span className="h-px flex-1 bg-white/10" />
                </div>
              )}

              <div className="space-y-3">
                {showGoogle && (
                  <>
                    <button
                      type="button"
                      disabled={authAction === "google"}
                      onClick={() => void handleGoogle()}
                      className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white py-3.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 disabled:opacity-70"
                    >
                      <GoogleIcon />
                      {authAction === "google"
                        ? "Redirecting…"
                        : "Continue with Google"}
                    </button>
                    {methodError.google && (
                      <p className="text-xs text-amber-200">{methodError.google}</p>
                    )}
                  </>
                )}

                <button
                  type="button"
                  disabled={walletBusy}
                  onClick={handleOpenWalletPicker}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 py-3.5 text-sm font-medium text-white transition hover:border-sky-500/40 hover:bg-white/5 disabled:opacity-70"
                >
                  <Wallet className="h-4 w-4 text-sky-400" />
                  {walletBusy ? "Waiting for wallet…" : "Continue with wallet"}
                </button>
                {methodError.wallet && (
                  <p className="text-xs text-amber-200">{methodError.wallet}</p>
                )}
              </div>

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
              {injectedWallets.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  disabled={walletBusy}
                  onClick={handleConnectWallet}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 py-3.5 text-sm font-medium text-white transition hover:border-sky-500/40 hover:bg-white/5 disabled:opacity-70"
                >
                  <Wallet className="h-4 w-4 text-sky-400" />
                  Connect {w.label} Wallet
                </button>
              ))}
              {injectedWallets.length === 0 && (
                <button
                  type="button"
                  disabled={walletBusy}
                  onClick={handleConnectWallet}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 py-3.5 text-sm font-medium text-white transition hover:border-sky-500/40 hover:bg-white/5 disabled:opacity-70"
                >
                  <Wallet className="h-4 w-4 text-sky-400" />
                  Connect wallet
                </button>
              )}
              <button
                type="button"
                disabled={walletBusy}
                onClick={() => {
                  setAuthAction("wallet");
                  setWalletConnecting(true);
                  openWallet({ view: "Connect" });
                }}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 py-3.5 text-sm font-medium text-white transition hover:border-sky-500/40 hover:bg-white/5 disabled:opacity-70"
              >
                WalletConnect
              </button>
              {walletBusy && (
                <p className="text-xs text-slate-500">
                  Approve the connection in your wallet extension.
                </p>
              )}
              {methodError.wallet && (
                <p className="text-xs text-amber-200">{methodError.wallet}</p>
              )}
            </div>
          )}

          {step === "otp" && showEmail && (
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
                  className="w-full rounded-xl bg-sky-500 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
                >
                  {authAction === "verify" ? "Verifying…" : "Continue"}
                </button>
              )}
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setStep("magic-sent")}
                  className="text-slate-500 underline hover:text-white"
                >
                  Use magic link instead
                </button>
                <button
                  type="button"
                  disabled={authAction === "email" || cooldown > 0}
                  onClick={() => void handleResend("otp")}
                  className="text-sky-400 hover:text-sky-300 disabled:opacity-50"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {step === "magic-sent" && showEmail && (
            <div className="mt-6 space-y-4">
              <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300">
                We sent a sign-in link to your email. Open it on this device to
                continue.
              </p>
              <button
                type="button"
                onClick={handleOpenWalletPicker}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 py-3 text-sm text-white hover:border-sky-500/40"
              >
                <Wallet className="h-4 w-4 text-sky-400" />
                Continue with wallet instead
              </button>
              {methodError.email && (
                <p className="text-xs text-amber-200">{methodError.email}</p>
              )}
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => void handleSwitchToOtp()}
                  className="text-slate-500 underline hover:text-white"
                >
                  Enter code instead
                </button>
                <button
                  type="button"
                  disabled={authAction === "email" || cooldown > 0}
                  onClick={() => void handleResend("magic_link")}
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
