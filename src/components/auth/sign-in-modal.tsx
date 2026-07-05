"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useConnect } from "wagmi";
import { ArrowLeft, Wallet } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { WalletAuthEffect } from "@/components/wallet/wallet-auth-effect";
import { enableGuestExploring } from "@/lib/auth/guest";
import {
  getRememberedEmail,
  setRememberedEmail,
} from "@/lib/auth/remember";
import { detectInjectedWallets } from "@/lib/wallet/detect";
import { ResolveLogoMark } from "@/components/resolve/brand/resolve-logo-mark";

type Step = "welcome" | "wallet-picker" | "forgot-password";
type AuthAction = "email" | "forgot" | "wallet" | "guest" | null;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function SignInModal() {
  const { open, closeSignIn } = useSignInModal();
  const {
    continueWithEmailPassword,
    requestPasswordReset,
    emailEnabled,
  } = useAuth();
  const account = useResolveAccount();
  const { open: openWallet, close: closeWallet } = useAppKit();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();

  const [step, setStep] = useState<Step>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(true);
  const [authAction, setAuthAction] = useState<AuthAction>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<{
    email?: string;
    wallet?: string;
  }>({});
  const [showForgotHint, setShowForgotHint] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);

  const showEmail = emailEnabled;
  const showWallet = true;
  const showDivider = showEmail && showWallet;
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
      setPassword("");
      setMethodError({});
      setShowForgotHint(false);
      setResetSent(false);
      setForgotCooldown(0);
      return;
    }

    const savedEmail = getRememberedEmail() ?? "";
    if (savedEmail) setEmail(savedEmail);
  }, [open]);

  useEffect(() => {
    if (!open || forgotCooldown <= 0) return;
    const id = window.setInterval(() => {
      setForgotCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, forgotCooldown]);

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

  async function handleEmailSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setInlineError(null);
    setMethodError((prev) => ({ ...prev, email: undefined }));
    setShowForgotHint(false);
    setResetSent(false);

    const trimmed = email.trim();
    if (!trimmed) {
      setInlineError("Enter your email address.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setInlineError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setInlineError("Password must be at least 6 characters.");
      return;
    }

    setAuthAction("email");
    try {
      if (rememberEmail) {
        setRememberedEmail(trimmed);
      }

      const result = await continueWithEmailPassword(trimmed, password);

      if (!result.ok) {
        setShowForgotHint(Boolean(result.suggestForgotPassword));
        setMethodError((prev) => ({ ...prev, email: result.message }));
        return;
      }

      setPassword("");
      closeSignIn();
    } finally {
      setAuthAction(null);
    }
  }

  async function handleForgotPassword() {
    if (forgotCooldown > 0) return;
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setInlineError("Enter your email address first.");
      return;
    }

    setAuthAction("forgot");
    setMethodError((prev) => ({ ...prev, email: undefined }));
    setInlineError(null);
    try {
      const result = await requestPasswordReset(trimmed);
      if (!result.ok) {
        if (result.cooldownSeconds) {
          setForgotCooldown(result.cooldownSeconds);
        }
        setMethodError((prev) => ({ ...prev, email: result.message }));
        return;
      }
      setResetSent(true);
      setForgotCooldown(15);
      setShowForgotHint(false);
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
      : step === "forgot-password"
        ? "We will email you a link to set a new password."
        : showEmail && showWallet
          ? "Enter email and password to continue, or connect a wallet."
          : showWallet
            ? "Connect a wallet to get started."
            : "Enter your email and password to continue.";

  const emailReady = isValidEmail(email) && password.length >= 6;
  const walletBusy =
    authAction === "wallet" || walletConnecting || connectPending;
  const rememberedEmail = getRememberedEmail();

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
          {(step === "wallet-picker" || step === "forgot-password") && (
            <button
              type="button"
              onClick={() => {
                setStep("welcome");
                setInlineError(null);
                setMethodError({});
                setResetSent(false);
              }}
              className="mb-4 flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}

          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <ResolveLogoMark size={40} className="mt-0.5 rounded-xl shadow-[0_0_16px_rgba(92,96,159,0.3)]" />
              <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-resolve-brand-periwinkle">
                RESOLVE
              </p>
              <h2 id="sign-in-title" className="mt-1 text-2xl font-semibold text-white">
                {step === "wallet-picker"
                  ? "Choose wallet"
                  : step === "forgot-password"
                    ? "Reset password"
                    : rememberedEmail && email
                      ? "Welcome back"
                      : "Welcome"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{subtitle}</p>
              </div>
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
                <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setInlineError(null);
                      setShowForgotHint(false);
                      setResetSent(false);
                    }}
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500/50"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setInlineError(null);
                      setShowForgotHint(false);
                    }}
                    placeholder="Password (6+ characters)"
                    autoComplete={rememberedEmail && email ? "current-password" : "new-password"}
                    minLength={6}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500/50"
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(e) => setRememberEmail(e.target.checked)}
                      className="rounded border-white/20 bg-black/30"
                    />
                    Remember my email on this device
                  </label>
                  <button
                    type="submit"
                    disabled={
                      authAction === "email" ||
                      authAction === "forgot" ||
                      !emailReady
                    }
                    className="w-full rounded-xl bg-sky-500 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {authAction === "email" ? "Continuing…" : "Continue"}
                  </button>
                  <p className="text-center text-[11px] text-slate-500">
                    New users create an account automatically. Returning users sign in.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleForgotPassword()}
                    disabled={
                      authAction === "email" ||
                      authAction === "forgot" ||
                      !isValidEmail(email) ||
                      forgotCooldown > 0
                    }
                    className="w-full text-center text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50"
                  >
                    {authAction === "forgot"
                      ? "Sending reset link…"
                      : forgotCooldown > 0
                        ? `Resend reset link in ${forgotCooldown}s`
                        : "Forgot password?"}
                  </button>
                  {resetSent && (
                    <p className="text-xs text-emerald-300">
                      Reset link sent. Open it on this device, then choose a new
                      password on the next screen.
                    </p>
                  )}
                  {inlineError && (
                    <p className="text-xs text-amber-200">{inlineError}</p>
                  )}
                  {methodError.email && (
                    <p className="text-xs text-amber-200">{methodError.email}</p>
                  )}
                  {showForgotHint && !resetSent && (
                    <p className="text-xs text-slate-400">
                      Signed in with email link before? Use{" "}
                      <button
                        type="button"
                        onClick={() => void handleForgotPassword()}
                        className="text-sky-400 hover:text-sky-300"
                      >
                        Forgot password
                      </button>{" "}
                      to set one.
                    </p>
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
