"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { tryCreateSupabaseBrowserClient } from "@/lib/supabase/client";

type Phase = "loading" | "confirm" | "form" | "error" | "success";

function createSupabaseClient(
  config: { url: string; anonKey: string } | null | undefined,
) {
  return (
    tryCreateSupabaseBrowserClient() ??
    (config ? createBrowserClient(config.url, config.anonKey) : null)
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const capabilities = useAuthCapabilities();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenHash = searchParams.get("token_hash");
  const recoveryType = (searchParams.get("type") ?? "recovery") as EmailOtpType;

  const clearRecoveryParams = useCallback(() => {
    router.replace("/auth/reset-password");
  }, [router]);

  const verifyRecoveryToken = useCallback(async () => {
    const config = capabilities.publicConfig;
    const supabase = createSupabaseClient(config);
    if (!supabase) {
      setError("Auth is not configured.");
      setPhase("error");
      return;
    }

    if (!tokenHash) {
      setError("Missing reset token. Request a new password reset email.");
      setPhase("error");
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: recoveryType,
      });
      if (verifyError) throw verifyError;

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        throw new Error("Could not start a reset session. Request a new link.");
      }

      clearRecoveryParams();
      setPhase("form");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not verify reset link.";
      setError(
        message.includes("invalid") || message.includes("expired") ?
          "This reset link expired or was already used. Request a new one and open only the latest email."
        : message,
      );
      setPhase("error");
    } finally {
      setVerifying(false);
    }
  }, [capabilities.publicConfig, clearRecoveryParams, recoveryType, tokenHash]);

  useEffect(() => {
    if (!capabilities.loaded) return;

    let cancelled = false;

    async function bootstrap() {
      const config = capabilities.publicConfig;
      const supabase = createSupabaseClient(config);

      const authErrorParam = searchParams.get("auth_error");
      if (authErrorParam) {
        if (!cancelled) {
          setError(decodeURIComponent(authErrorParam));
          setPhase("error");
        }
        return;
      }

      if (!supabase) {
        if (!cancelled) {
          setError("Auth is not configured.");
          setPhase("error");
        }
        return;
      }

      try {
        const code = searchParams.get("code");
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          if (!cancelled) {
            clearRecoveryParams();
            setPhase("form");
          }
          return;
        }

        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          if (!cancelled) {
            setPhase("form");
          }
          return;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (data.session) {
          if (!cancelled) setPhase("form");
          return;
        }

        if (tokenHash) {
          if (!cancelled) setPhase("confirm");
          return;
        }

        throw new Error(
          "Open the reset link from your email, or request a new one from sign-in.",
        );
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not verify reset link. Request a new one.",
          );
          setPhase("error");
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    capabilities.loaded,
    capabilities.publicConfig,
    clearRecoveryParams,
    searchParams,
    tokenHash,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    const supabase = createSupabaseClient(capabilities.publicConfig);
    if (!supabase) {
      setError("Auth is not configured.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      await fetch("/api/wallet/provision", {
        method: "POST",
        credentials: "include",
      }).catch(() => {
        /* non-fatal */
      });

      setPhase("success");
      window.setTimeout(() => {
        router.replace("/mission");
      }, 1200);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save password. Try again.",
      );
      setPhase("form");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05080c] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c1219] to-[#05080c] p-8 shadow-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-400">
          RESOLVE
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Set your password
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Choose a password for your account. You will use your email and this
          password to sign in next time.
        </p>

        {phase === "loading" && (
          <p className="mt-6 text-sm text-slate-400">Loading…</p>
        )}

        {phase === "confirm" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-300">
              Tap continue to verify your reset link and choose a new password.
              Use only the <strong className="font-medium text-white">latest</strong>{" "}
              email if you requested more than one.
            </p>
            <button
              type="button"
              disabled={verifying}
              onClick={() => void verifyRecoveryToken()}
              className="w-full rounded-xl bg-sky-500 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
            >
              {verifying ? "Verifying…" : "Continue to set password"}
            </button>
          </div>
        )}

        {error && phase !== "form" && phase !== "success" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-amber-200">{error}</p>
            <Link
              href="/"
              className="inline-block text-sm text-sky-400 hover:text-sky-300"
            >
              Back to sign in
            </Link>
          </div>
        )}

        {phase === "form" && (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-3">
            {error && <p className="text-sm text-amber-200">{error}</p>}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (6+ characters)"
              autoComplete="new-password"
              minLength={6}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500/50"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              minLength={6}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500/50"
            />
            <button
              type="submit"
              disabled={submitting || password.length < 6}
              className="w-full rounded-xl bg-sky-500 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save password"}
            </button>
          </form>
        )}

        {phase === "success" && (
          <p className="mt-6 text-sm text-emerald-300">
            Password saved. Taking you to Mission…
          </p>
        )}
      </div>
    </div>
  );
}
