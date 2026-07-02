"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useConnect } from "wagmi";
import { ArrowLeft, Mail, Wallet } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { WalletAuthEffect } from "@/components/wallet/wallet-auth-effect";
import { enableGuestExploring } from "@/lib/auth/guest";
import { getRememberedEmail } from "@/lib/auth/remember";
import { detectInjectedWallets } from "@/lib/wallet/detect";
import {
  formatSignInCooldown,
  getSignInCooldownRemaining,
  hasSignInVerifyPending,
  markSignInVerifyPending,
  setSignInCooldownSeconds,
  SIGN_IN_EMAIL_KEY,
} from "@/lib/auth/sign-in-storage";

type Step = "welcome" | "verify" | "wallet-picker";
type AuthAction = "email" | "google" | "github" | "wallet" | "guest" | null;

const DEFAULT_RESEND_COOLDOWN_SEC = 15;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function SignInModal() {
  const { open, closeSignIn } = useSignInModal();
  const {
    sendLoginCode,
    emailEnabled,
    googleEnabled,
    githubEnabled,
  } = useAuth();
  const capabilities = useAuthCapabilities();
  const account = useResolveAccount();
  const { open: openWallet, close: closeWallet } = useAppKit();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();

  const [step, setStep] = useState<Step>("welcome");
  const [email, setEmail] = useState("");
  const [authAction, setAuthAction] = useState<AuthAction>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [linkValidMinutes, setLinkValidMinutes] = useState(15);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<{
    google?: string;
    github?: string;
    email?: string;
    wallet?: string;
  }>({});

  const showEmail = emailEnabled;
  const showGoogle = capabilities.loaded && googleEnabled;
  const showGithub = capabilities.loaded && githubEnabled;
  const showWallet = true;
  const showDivider = showEmail && (showGoogle || showGithub || showWallet);
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
      return;
    }

    let savedEmail = "";
    try {
      savedEmail =
        localStorage.getItem(SIGN_IN_EMAIL_KEY) ??
        getRememberedEmail() ??
        "";
      if (savedEmail) setEmail(savedEmail);
    } catch {
      /* ignore */
    }

    const remaining = getSignInCooldownRemaining();
    setCooldown(remaining);

    if (remaining > 0 && savedEmail && hasSignInVerifyPending()) {
      setStep("verify");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const tick = () => setCooldown(getSignInCooldownRemaining());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open]);

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

  function goToVerifyStep(cooldownSeconds: number, validMinutes: number) {
    setLinkValidMinutes(validMinutes);
    setStep("verify");
    markSignInVerifyPending(email.trim());
    setSignInCooldownSeconds(cooldownSeconds);
    setCooldown(cooldownSeconds);
    setMethodError((prev) => ({ ...prev, email: undefined }));
    setInlineError(null);
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

    if (cooldown > 0 && hasSignInVerifyPending()) {
      goToVerifyStep(cooldown, linkValidMinutes);
      return;
    }

    setAuthAction("email");
    try {
      localStorage.setItem(SIGN_IN_EMAIL_KEY, trimmed);
      const result = await sendLoginCode(trimmed);

      if (!result.ok) {
        if (result.cooldownSeconds) {
          setSignInCooldownSeconds(result.cooldownSeconds);
          setCooldown(result.cooldownSeconds);
        }
        if (result.pendingVerify) {
          goToVerifyStep(
            result.cooldownSeconds ?? cooldown ?? DEFAULT_RESEND_COOLDOWN_SEC,
            linkValidMinutes
          );
          return;
        }
        setMethodError((prev) => ({ ...prev, email: result.message }));
        return;
      }

      goToVerifyStep(
        result.resendCooldownSeconds ?? DEFAULT_RESEND_COOLDOWN_SEC,
        result.expiresInMinutes ?? 15
      );
    } finally {
      setAuthAction(null);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || authAction === "email") return;
    setAuthAction("email");
    setMethodError((prev) => ({ ...prev, email: undefined }));
    setInlineError(null);
    try {
      const result = await sendLoginCode(email.trim());
      if (!result.ok) {
        if (result.cooldownSeconds) {
          setSignInCooldownSeconds(result.cooldownSeconds);
          setCooldown(result.cooldownSeconds);
        }
        if (result.pendingVerify) {
          return;
        }
        setMethodError((prev) => ({
          ...prev,
          email: result.message,
        }));
        return;
      }
      goToVerifyStep(
        result.resendCooldownSeconds ?? DEFAULT_RESEND_COOLDOWN_SEC,
        result.expiresInMinutes ?? 15
      );
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
      : step === "verify"
        ? `We sent a secure sign-in link to ${email}.`
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
          {(step === "wallet-picker" || step === "verify") && (
            <button
              type="button"
              onClick={() => {
                setStep("welcome");
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
                {step === "verify"
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
                      ? "Sending link…"
                      : cooldown > 0
                        ? `Check your email · resend in ${formatSignInCooldown(cooldown)}`
                        : "Continue with email"}
                  </button>
                  {inlineError && (
                    <p className="text-xs text-amber-200">{inlineError}</p>
                  )}
                  {methodError.email && (
                    <p className="text-xs text-amber-200">{methodError.email}</p>
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
                {showGithub && (
                  <form action="/api/auth/oauth/github" method="get">
                    <input type="hidden" name="next" value="/profile" />
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#24292f] py-3.5 text-sm font-medium text-white transition hover:bg-[#2f363d]"
                    >
                      <GithubIcon />
                      Continue with GitHub
                    </button>
                  </form>
                )}

                {showGoogle && (
                  <form action="/api/auth/oauth/google" method="get">
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white py-3.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                    >
                      <GoogleIcon />
                      Continue with Google
                    </button>
                  </form>
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

          {step === "verify" && showEmail && (
            <div className="mt-6 space-y-5">
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-4 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                  <div>
                    <p>
                      Open the email on <span className="text-white">this device</span>{" "}
                      and tap <span className="font-medium text-white">Sign in to RESOLVE</span>.
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      The link expires in {linkValidMinutes} minutes and works once.
                      Check spam if you do not see it within a minute.
                    </p>
                  </div>
                </div>
              </div>

              {methodError.email && (
                <p className="text-center text-xs text-amber-200">{methodError.email}</p>
              )}
              <button
                type="button"
                onClick={handleOpenWalletPicker}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 py-3 text-sm text-white hover:border-sky-500/40"
              >
                <Wallet className="h-4 w-4 text-sky-400" />
                Continue with wallet instead
              </button>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Keep this tab open after you tap the link.</span>
                <button
                  type="button"
                  disabled={authAction === "email" || cooldown > 0}
                  onClick={() => void handleResend()}
                  className="text-sky-400 hover:text-sky-300 disabled:opacity-50"
                >
                  {cooldown > 0
                    ? `Resend in ${formatSignInCooldown(cooldown)}`
                    : "Resend link"}
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

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
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
