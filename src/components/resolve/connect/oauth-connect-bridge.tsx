"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";

type Provider = "github" | "github_app" | "listenbrainz";

const PROVIDERS: Record<
  Provider,
  {
    title: string;
    subtitle: string;
    authorizeApi: string;
    icon: string;
    externalNote?: string;
  }
> = {
  github: {
    title: "GitHub",
    subtitle: "Connect your open-source identity",
    authorizeApi: "/api/connectors/github/authorize",
    icon: "GH",
    externalNote:
      "If you're signed in to GitHub, this is one click. RESOLVE stores your verified username.",
  },
  github_app: {
    title: "GitHub repository access",
    subtitle: "Choose the repositories RESOLVE may evaluate",
    authorizeApi: "/api/connectors/github/installation/authorize",
    icon: "GH",
    externalNote:
      "GitHub will show the repositories you grant to the RESOLVE GitHub App. You can change or revoke access from GitHub.",
  },
  listenbrainz: {
    title: "MusicBrainz",
    subtitle: "Connect ListenBrainz listening history",
    authorizeApi: "/api/connectors/listenbrainz/authorize",
    icon: "MB",
    externalNote:
      "Uses your MusicBrainz account. If you're already signed in, you'll only approve access once.",
  },
};

export function OAuthConnectBridge({
  provider,
  returnTo = "/profile",
}: {
  provider: Provider;
  returnTo?: string;
}) {
  const config = PROVIDERS[provider];
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [delayed, setDelayed] = useState(false);
  const target = useMemo(
    () => `${config.authorizeApi}?returnTo=${encodeURIComponent(returnTo)}`,
    [config.authorizeApi, returnTo],
  );

  useEffect(() => {
    let cancelled = false;
    if (provider !== "github_app") {
      void fetch("/api/health/oauth", { credentials: "include" })
        .then((response) => response.json())
        .then((body) => {
          if (cancelled) return;
          const url =
            provider === "github"
              ? (body.github?.callbackUrl as string | undefined)
              : (body.listenbrainz?.callbackUrl as string | undefined);
          setCallbackUrl(url ?? null);
        })
        .catch(() => undefined);
    }

    const timer = window.setTimeout(() => window.location.replace(target), 250);
    const delayedTimer = window.setTimeout(() => setDelayed(true), 8_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(delayedTimer);
    };
  }, [provider, target]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0f18]/95 p-8 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-resolve-accent to-blue-600 text-sm font-bold text-white">
            {config.icon}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
              RESOLVE Connect
            </p>
            <h1 className="text-xl font-semibold text-white">{config.title}</h1>
            <p className="text-sm text-resolve-muted">{config.subtitle}</p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          {delayed ? (
            <CircleAlert className="h-5 w-5 text-amber-300" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-resolve-accent" />
          )}
          <p className="text-sm text-white">
            {delayed
              ? `${config.title} is taking longer than expected.`
              : `Redirecting securely to ${config.title}...`}
          </p>
        </div>

        {config.externalNote && (
          <p className="mt-4 text-xs leading-relaxed text-resolve-muted-dim">
            {config.externalNote}
          </p>
        )}

        {callbackUrl && (
          <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
              If GitHub reports an invalid redirect URI
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-amber-100/80">{callbackUrl}</p>
            <p className="mt-2 text-[11px] text-resolve-muted-dim">
              Add this exact URL in the provider settings, then retry.
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between text-xs">
          <Link href={returnTo} className="text-resolve-muted hover:text-white">
            Back
          </Link>
          <button
            type="button"
            className="font-medium text-resolve-accent hover:underline"
            onClick={() => {
              setDelayed(false);
              window.location.replace(target);
            }}
          >
            {delayed ? "Retry connection" : "Continue now"}
          </button>
        </div>
      </div>
    </div>
  );
}
