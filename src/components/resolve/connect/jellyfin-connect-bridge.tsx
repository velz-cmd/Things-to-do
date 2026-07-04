"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Tv } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/resolve/ui/button";
import { authenticateJellyfinInBrowser } from "@/lib/integrations/jellyfin-browser";
import { pushJellyfinWatchesFromBrowser } from "@/lib/integrations/jellyfin-client-sync";
import { saveJellyfinSession } from "@/lib/integrations/jellyfin-shared";

export function JellyfinConnectBridge({ returnTo = "/profile" }: { returnTo?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("http://127.0.0.1:8096");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const trimmedUrl = url.trim();
      const trimmedUser = username.trim();

      let workingUrl = trimmedUrl;
      let accessToken: string | undefined;

      const auth = await authenticateJellyfinInBrowser(trimmedUrl, trimmedUser, password);
      if (auth.ok) {
        workingUrl = auth.auth.url;
        accessToken = auth.auth.accessToken;
      }

      const res = await fetch("/api/profile/connect/jellyfin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: workingUrl,
          username: trimmedUser,
          password,
          ...(accessToken ? { accessToken } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        if (!auth.ok) throw new Error(auth.error);
        throw new Error(data.error ?? "Could not save Jellyfin connection");
      }

      saveJellyfinSession({
        url: workingUrl,
        username: trimmedUser,
        password,
        accessToken,
      });

      if (accessToken) {
        void pushJellyfinWatchesFromBrowser({ url: workingUrl, accessToken }).catch(() => undefined);
      } else if (auth.ok) {
        void pushJellyfinWatchesFromBrowser().catch(() => undefined);
      }

      toast.success(data.message ?? "Jellyfin connected");
      router.replace(`${returnTo}?jellyfin_connected=1`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not connect Jellyfin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0f18]/95 p-8 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
            <Tv className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
              RESOLVE Connect
            </p>
            <h1 className="text-xl font-semibold text-white">Jellyfin</h1>
            <p className="text-sm text-resolve-muted">Connect your video library</p>
          </div>
        </div>

        <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://127.0.0.1:8096"
            type="url"
            required
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none"
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Jellyfin username"
            required
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Jellyfin account password"
            type="password"
            required
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none"
          />
          <p className="text-[11px] leading-relaxed text-resolve-muted-dim">
            Use the same username and password you sign in with on Jellyfin — not an API key. RESOLVE
            installs the community and syncs your watches automatically.
          </p>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ?
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting…
              </>
            : "Connect Jellyfin"}
          </Button>
        </form>

        <div className="mt-6 text-xs">
          <Link href={returnTo} className="text-resolve-muted hover:text-white">
            ← Back to profile
          </Link>
        </div>
      </div>
    </div>
  );
}
