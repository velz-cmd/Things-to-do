"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { tryCreateSupabaseBrowserClient } from "@/lib/supabase/client";

/** Fallback for hash-fragment sessions when the server callback has no ?code= param. */
export default function AuthCallbackCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const capabilities = useAuthCapabilities();

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
        router.replace("/?auth_error=Auth%20not%20configured");
        return;
      }

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
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
          const next = searchParams.get("next") ?? "/missions";
          router.replace(next);
        }
      } catch (e) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace("/missions");
          return;
        }
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
  }, [capabilities.loaded, capabilities.publicConfig, router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05080c] px-4 text-center text-slate-300">
      <div>
        <p className="text-sm font-medium text-white">Signing you in…</p>
        <p className="mt-2 text-xs text-slate-500">Completing your secure sign-in.</p>
      </div>
    </div>
  );
}
