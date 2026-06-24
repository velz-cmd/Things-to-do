"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { GMAIL_AFTER_AUTH_KEY } from "@/lib/auth/guest";

/** After wallet-only user links Google for Gmail, continue to Gmail OAuth. */
export function GmailAfterAuthEffect() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    try {
      if (sessionStorage.getItem(GMAIL_AFTER_AUTH_KEY) === "1") {
        sessionStorage.removeItem(GMAIL_AFTER_AUTH_KEY);
        window.location.href = "/api/connectors/gmail/authorize";
      }
    } catch {
      /* ignore */
    }
  }, [user]);

  return null;
}
