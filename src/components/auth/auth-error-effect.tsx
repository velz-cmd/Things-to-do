"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { markGoogleAuthBroken } from "@/hooks/use-auth-capabilities";
import { useAuth } from "@/components/auth/auth-provider";
import { toast } from "sonner";

/** Surface auth redirect errors; suppress noise when the user is already signed in. */
export function AuthErrorEffect() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const err = params.get("auth_error");
    if (!err) return;

    const decoded = decodeURIComponent(err);
    const isPkceNoise =
      decoded.includes("PKCE") ||
      decoded.includes("code verifier") ||
      decoded.includes("already used");

    if (user && isPkceNoise) {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_error");
      router.replace(url.pathname + url.search);
      return;
    }

    if (user && decoded.includes("expired")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_error");
      router.replace(url.pathname + url.search);
      return;
    }

    toast.error(decoded);
    if (
      decoded.includes("redirect_uri_mismatch") ||
      decoded.includes("redirect") ||
      decoded.includes("OAuth")
    ) {
      markGoogleAuthBroken();
    }
  }, [params, user, router]);

  return null;
}
