"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { tryCreateSupabaseBrowserClient } from "@/lib/supabase/client";

function readHashParams() {
  const hash = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(hash);
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const capabilities = useAuthCapabilities();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const config = capabilities.publicConfig;
      const supabase =
        tryCreateSupabaseBrowserClient() ??
        (config
          ? createBrowserClient(config.url, config.anonKey)
          : null);

      if (!supabase) {
        if (!cancelled) {
          setError("Auth is not configured.");
        }
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;
      const authError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

      if (authError) {
        if (!cancelled) {
          router.replace(`/?auth_error=${encodeURIComponent(authError)}`);
        }
        return;
      }

      try {
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (verifyError) throw verifyError;
        } else {
          const hash = readHashParams();
          const accessToken = hash.get("access_token");
          const refreshToken = hash.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
          } else {
            throw new Error(
              "Sign-in link expired or already used. Request a new one."
            );
          }
        }

        await fetch("/api/wallet/provision", {
          method: "POST",
          credentials: "include",
        }).catch(() => {
          /* non-fatal */
        });

        if (!cancelled) {
          router.replace("/start");
        }
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "Sign-in link expired or already used. Request a new one.";
        if (!cancelled) {
          router.replace(`/?auth_error=${encodeURIComponent(message)}`);
        }
      }
    }

    if (capabilities.loaded) {
      void finish();
    }

    return () => {
      cancelled = true;
    };
  }, [capabilities.loaded, capabilities.publicConfig, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05080c] px-4 text-center text-slate-300">
      <div>
        <p className="text-sm font-medium text-white">Signing you in…</p>
        <p className="mt-2 text-xs text-slate-500">
          {error ?? "Completing your secure sign-in."}
        </p>
      </div>
    </div>
  );
}
