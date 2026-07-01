"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";

const SESSION_SYNC_KEY = "resolve_sensor_sync_v1";

/** One background sensor sync per browser session after sign-in — not on every page load nag. */
export function SensorBackgroundSync() {
  const { user } = useAuth();
  const { state, refreshSync } = useUserConnections();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!user || !state.signedIn || !state.hasAnyConnector) return;
    if (ranRef.current) return;

    const sessionKey = `${SESSION_SYNC_KEY}:${user.id}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(sessionKey)) {
      ranRef.current = true;
      return;
    }

    ranRef.current = true;
    void refreshSync().then(() => {
      try {
        sessionStorage.setItem(sessionKey, new Date().toISOString());
      } catch {
        /* private mode */
      }
    });
  }, [user, state.signedIn, state.hasAnyConnector, refreshSync]);

  return null;
}
