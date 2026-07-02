"use client";

import { useCallback, useEffect, useState } from "react";

const GOOGLE_BROKEN_KEY = "resolve.auth.googleBroken";

export type AuthCapabilities = {
  supabase: boolean;
  email: boolean;
  emailMagicLink: boolean;
  emailOtp: boolean;
  google: boolean;
  github: boolean;
  wallet: boolean;
  guest: boolean;
  publicConfig: { url: string; anonKey: string } | null;
  loaded: boolean;
};

const DEFAULT: AuthCapabilities = {
  supabase: false,
  email: false,
  emailMagicLink: false,
  emailOtp: false,
  google: false,
  github: false,
  wallet: true,
  guest: true,
  publicConfig: null,
  loaded: false,
};

export function markGoogleAuthBroken() {
  try {
    localStorage.setItem(GOOGLE_BROKEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isGoogleAuthBroken(): boolean {
  try {
    return localStorage.getItem(GOOGLE_BROKEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function useAuthCapabilities(): AuthCapabilities {
  const [caps, setCaps] = useState<AuthCapabilities>(DEFAULT);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/capabilities", { cache: "no-store" });
      if (!res.ok) {
        setCaps((prev) => ({ ...prev, loaded: true }));
        return;
      }
      const data = await res.json();
      const googleBroken = isGoogleAuthBroken();
      setCaps({
        supabase: Boolean(data.supabase),
        email: Boolean(data.email),
        emailMagicLink: Boolean(data.emailPassword ?? data.email),
        emailOtp: false,
        google: Boolean(data.google) && !googleBroken,
        github: Boolean(data.github),
        wallet: true,
        guest: true,
        publicConfig: data.publicConfig ?? null,
        loaded: true,
      });
    } catch {
      setCaps((prev) => ({ ...prev, loaded: true }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return caps;
}
