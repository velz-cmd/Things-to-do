"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  Key,
  Plug,
  Shield,
  Webhook,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Radio,
} from "lucide-react";
import type { ConnectorLiveStatus } from "@/lib/connectors/live-stats";
import type { SettingsConnection } from "@/app/api/settings/status/route";

type OperatorIntegration = {
  id: string;
  label: string;
  configured: boolean;
  detail: string;
  health?: string;
};

type SettingsSnapshot = {
  ok: boolean;
  signedIn: boolean;
  connections: SettingsConnection[];
  operatorIntegrations?: OperatorIntegration[];
  distributionSensors: ConnectorLiveStatus[];
  communitySensors: {
    slug: string;
    sensorLive: boolean;
    sensorGated: boolean;
    message: string;
  }[];
  platform: {
    llmEnabled: boolean;
    resendEnabled: boolean;
    arcMemos: { enabled: boolean; canDistributeOnChain: boolean; message: string };
    gmailOAuth: boolean;
  };
  operatorKeys: {
    name: string;
    purpose: string;
    required: boolean;
    configured: boolean;
  }[];
  cron: {
    configured: boolean;
    runtimeOk: boolean;
    whitespace: boolean;
    claimTokenConfigured: boolean;
    claimTokenWhitespace: boolean;
  };
};

function StatusPill({
  ok,
  label,
  warn,
}: {
  ok: boolean;
  label: string;
  warn?: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        ok ? "bg-emerald-500/15 text-emerald-300"
        : warn ? "bg-amber-500/10 text-amber-200/90"
        : "bg-white/[0.06] text-resolve-muted",
      )}
    >
      {ok ?
        <CheckCircle2 className="h-3 w-3" />
      : <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function healthLabel(health?: string) {
  if (!health) return null;
  if (health === "healthy") return "Live";
  if (health === "waiting") return "Waiting";
  if (health === "syncing") return "Syncing";
  if (health === "offline") return "Offline";
  return health;
}

export function SettingsSurface() {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/settings/status", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load settings"))))
      .then((data: SettingsSnapshot) => setSnapshot(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <header className="mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Admin
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-2 text-sm text-resolve-muted">
          Your connections, distribution sensors, and operator keys — ledger-backed status only.
        </p>
      </header>

      {error && (
        <p className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="mb-10 border-b border-resolve-border pb-10">
        <div className="mb-4 flex items-center gap-2">
          <Plug className="h-4 w-4 text-resolve-accent" />
          <h2 className="text-sm font-semibold text-white">Your connections</h2>
        </div>
        <p className="mb-4 text-xs text-resolve-muted">
          Identity linking for attribution and claims. Manage details on{" "}
          <Link href="/profile" className="text-resolve-accent hover:underline">
            Profile
          </Link>
          .
        </p>
        {loading ?
          <p className="text-sm text-resolve-muted">Loading connection status…</p>
        : !snapshot?.signedIn ?
          <div className="rounded-xl border border-dashed border-resolve-border/80 px-4 py-6 text-sm text-resolve-muted">
            <p>Sign in to see your email, GitHub, and wallet status.</p>
            <Link href="/profile" className="mt-2 inline-block text-resolve-accent hover:underline">
              Go to Profile to sign in →
            </Link>
          </div>
        : !snapshot.connections.length ?
          <p className="text-sm text-resolve-muted">Sign in to see your connections.</p>
        : <ul className="divide-y divide-resolve-border/60 rounded-xl border border-resolve-border/60">
            {snapshot.connections.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{c.label}</p>
                  {c.displayValue && (
                    <p className="mt-0.5 truncate font-mono text-xs text-emerald-300/90">
                      {c.displayValue}
                    </p>
                  )}
                  {c.hint && (
                    <p className="mt-0.5 text-xs text-resolve-muted">{c.hint}</p>
                  )}
                  {c.eventsToday != null && c.eventsToday > 0 && (
                    <p className="mt-1 text-[10px] text-resolve-muted-dim">
                      {c.eventsToday} sensor event{c.eventsToday === 1 ? "" : "s"} today
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusPill
                    ok={c.connected}
                    label={c.connected ? "Connected" : "Not linked"}
                    warn={!c.connected && (c.id === "github" || c.id === "email")}
                  />
                  {c.health && (
                    <span className="text-[10px] text-resolve-muted-dim">
                      Sensor: {healthLabel(c.health)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        }
      </section>

      <section className="mb-10 border-b border-resolve-border pb-10">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-resolve-accent" />
          <h2 className="text-sm font-semibold text-white">Vercel integrations</h2>
        </div>
        <p className="mb-4 text-xs text-resolve-muted">
          Operator-configured on Vercel — separate from your personal Profile links.
        </p>
        {loading ?
          <p className="text-sm text-resolve-muted">Loading…</p>
        : <ul className="divide-y divide-resolve-border/60 rounded-xl border border-resolve-border/60">
            {(snapshot?.operatorIntegrations ?? []).map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="mt-0.5 text-xs text-resolve-muted">{item.detail}</p>
                </div>
                <StatusPill
                  ok={item.configured}
                  label={item.configured ? "Configured" : "Missing"}
                />
              </li>
            ))}
          </ul>
        }
      </section>

      <section className="mb-10 border-b border-resolve-border pb-10">
        <div className="mb-4 flex items-center gap-2">
          <Radio className="h-4 w-4 text-resolve-accent" />
          <h2 className="text-sm font-semibold text-white">Distribution sensors</h2>
        </div>
        <p className="mb-4 text-xs text-resolve-muted">
          Platform sensors writing real authorizations to the ledger — not your personal OAuth.
        </p>
        {loading ?
          <p className="text-sm text-resolve-muted">Loading sensors…</p>
        : <ul className="divide-y divide-resolve-border/60 rounded-xl border border-resolve-border/60">
            {(snapshot?.distributionSensors ?? []).map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{s.label}</p>
                  <p className="mt-0.5 text-xs text-resolve-muted">{s.description}</p>
                  <p className="mt-1 text-[10px] text-resolve-muted-dim">
                    {s.authorizationCount} authorization{s.authorizationCount === 1 ? "" : "s"} · $
                    {s.authorizationVolumeUsd.toFixed(2)} recognized
                    {s.eventsToday > 0 ? ` · ${s.eventsToday} today` : ""}
                  </p>
                </div>
                <StatusPill
                  ok={s.health === "healthy"}
                  label={healthLabel(s.health) ?? s.health}
                  warn={s.health === "waiting" || s.health === "syncing"}
                />
              </li>
            ))}
          </ul>
        }
        {snapshot?.communitySensors?.length ?
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted">
              Community sensor gates
            </p>
            <ul className="mt-2 space-y-1">
              {snapshot.communitySensors
                .filter((s) => s.sensorGated)
                .map((s) => (
                  <li key={s.slug} className="flex items-center justify-between text-xs">
                    <span className="text-resolve-muted">{s.slug}</span>
                    <StatusPill
                      ok={s.sensorLive}
                      label={s.sensorLive ? "Live in ledger" : "No events yet"}
                    />
                  </li>
                ))}
            </ul>
          </div>
        : null}
      </section>

      <section className="mb-10 border-b border-resolve-border pb-10">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-4 w-4 text-resolve-accent" />
          <h2 className="text-sm font-semibold text-white">Operator keys</h2>
        </div>
        <p className="mb-4 text-xs text-resolve-muted">
          Server env on Vercel — presence only, values never sent to the browser.
        </p>
        <ul className="space-y-2">
          {(snapshot?.operatorKeys ?? []).map((k) => (
            <li
              key={k.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <div>
                <p className="font-mono text-xs text-white">{k.name}</p>
                <p className="text-[11px] text-resolve-muted">{k.purpose}</p>
              </div>
              <StatusPill
                ok={k.configured}
                label={k.configured ? "Set" : k.required ? "Missing" : "Optional"}
                warn={!k.configured && k.required}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10 border-b border-resolve-border pb-10">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-resolve-accent" />
          <h2 className="text-sm font-semibold text-white">Platform health</h2>
        </div>
        {snapshot?.platform && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] p-4">
              <p className="text-xs text-resolve-muted">LLM reasoning</p>
              <StatusPill
                ok={snapshot.platform.llmEnabled}
                label={snapshot.platform.llmEnabled ? "Configured" : "Missing"}
              />
            </div>
            <div className="rounded-xl border border-white/[0.06] p-4">
              <p className="text-xs text-resolve-muted">Earn email (Resend)</p>
              <StatusPill
                ok={snapshot.platform.resendEnabled}
                label={snapshot.platform.resendEnabled ? "Live" : "Off"}
              />
            </div>
            <div className="rounded-xl border border-white/[0.06] p-4">
              <p className="text-xs text-resolve-muted">Arc settlement</p>
              <StatusPill
                ok={snapshot.platform.arcMemos.canDistributeOnChain}
                label={
                  snapshot.platform.arcMemos.canDistributeOnChain ? "On-chain" : "Ledger only"
                }
              />
              <p className="mt-2 text-[10px] text-resolve-muted">
                {snapshot.platform.arcMemos.message}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] p-4">
              <p className="text-xs text-resolve-muted">Gmail OAuth (operator)</p>
              <StatusPill
                ok={snapshot.platform.gmailOAuth}
                label={snapshot.platform.gmailOAuth ? "OAuth ready" : "Not configured"}
              />
            </div>
            <div className="rounded-xl border border-white/[0.06] p-4 sm:col-span-2">
              <p className="text-xs text-resolve-muted">Cron secret</p>
              <StatusPill
                ok={snapshot.cron.runtimeOk}
                label={snapshot.cron.configured ? "Configured" : "Missing"}
                warn={snapshot.cron.whitespace}
              />
              {snapshot.cron.whitespace && (
                <p className="mt-2 text-[10px] text-amber-200/80">
                  CRON_SECRET has whitespace in Vercel — runtime trims it; re-save without spaces to
                  clear warning.
                </p>
              )}
            </div>
          </div>
        )}
        <Link
          href="/api/health/live"
          target="_blank"
          className="mt-4 inline-flex items-center gap-1 text-xs text-resolve-accent hover:underline"
        >
          Live sensor health JSON
          <ExternalLink className="h-3 w-3" />
        </Link>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Webhook className="h-4 w-4 text-resolve-accent" />
          <h2 className="text-sm font-semibold text-white">Webhooks & cron</h2>
        </div>
        <p className="text-sm text-resolve-muted">
          Sensor ticks every 6 hours via GitHub Actions{" "}
          <span className="font-mono text-xs text-white/80">cron-daily.yml</span> — POST{" "}
          <span className="font-mono text-xs">/api/cron/tick</span> with{" "}
          <span className="font-mono text-xs">Authorization: Bearer $CRON_SECRET</span>.
        </p>
        <p className="mt-3 text-xs text-resolve-muted-dim">
          Each tick: incremental sensor sync, deposit-funded claimable release, earn notify.
          Bootstrap: <span className="font-mono">POST /api/cron/bootstrap-sensors</span> (operator).
        </p>
      </section>
    </div>
  );
}
