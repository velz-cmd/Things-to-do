"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plug } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

const DISMISS_KEY = "resolve-mission-connector-nudge";

export function MissionConnectorNudge({
  communitySlug,
  visible,
}: {
  communitySlug?: string | null;
  visible: boolean;
}) {
  const { user } = useAuth();
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!user || !visible) return;
    void fetch("/api/connectors/status", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { connectors?: Array<{ id: string; state?: string }> }) => {
        const gh = data.connectors?.find((c) => c.id === "github");
        setGithubConnected(gh?.state === "connected");
      })
      .catch(() => setGithubConnected(null));
  }, [user, visible]);

  if (!visible || !user || dismissed || githubConnected !== false) return null;
  if (!communitySlug || communitySlug === "independent-music") return null;

  return (
    <div className="mx-auto mb-3 max-w-2xl rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-xs text-amber-100">
      <p className="flex items-start gap-2">
        <Plug className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Connect GitHub once so ledger payees stay accurate for{" "}
          <span className="font-medium text-white">{communitySlug}</span> missions.{" "}
          <Link href="/profile?tab=connections" className="text-resolve-accent hover:underline">
            Profile → Connections
          </Link>
        </span>
      </p>
      <button
        type="button"
        className="mt-2 text-[10px] text-resolve-muted-dim hover:text-white"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
      >
        Dismiss for this session
      </button>
    </div>
  );
}
