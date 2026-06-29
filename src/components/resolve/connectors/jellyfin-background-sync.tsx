"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { pushJellyfinWatchesFromBrowser } from "@/lib/integrations/jellyfin-client-sync";

type JellyfinSyncConfig = {
  url: string;
  accessToken: string;
};

/** Polls Jellyfin from the user's browser while signed in — handles localhost without a bridge script. */
export function JellyfinBackgroundSync() {
  const { user } = useAuth();
  const configRef = useRef<JellyfinSyncConfig | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadConfig() {
      const res = await fetch("/api/profile/bootstrap", { credentials: "include" });
      const data = (await res.json()) as {
        signedIn?: boolean;
        jellyfinSync?: JellyfinSyncConfig | null;
      };
      if (cancelled || !data.signedIn || !data.jellyfinSync?.url || !data.jellyfinSync.accessToken) {
        configRef.current = null;
        return;
      }
      configRef.current = data.jellyfinSync;
    }

    async function tick() {
      const cfg = configRef.current;
      if (!cfg) return;
      try {
        await pushJellyfinWatchesFromBrowser(cfg);
      } catch {
        /* non-fatal background poll */
      }
    }

    void loadConfig().then(() => void tick());

    const configTimer = window.setInterval(() => void loadConfig(), 5 * 60_000);
    const syncTimer = window.setInterval(() => void tick(), 3 * 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(configTimer);
      window.clearInterval(syncTimer);
    };
  }, [user]);

  return null;
}
