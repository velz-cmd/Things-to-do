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
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

type ConnectorStatus = {
  id: string;
  label: string;
  connected: boolean;
  category?: string;
  message?: string;
};

type ConfigSnapshot = {
  llmEnabled?: boolean;
  resendEnabled?: boolean;
  arcMemos?: {
    enabled: boolean;
    canDistributeOnChain: boolean;
    message: string;
  };
  integrations?: {
    gmail?: { oauthConfigured: boolean; refreshTokenConfigured: boolean };
    walletLabels?: { configured: boolean };
  };
  agentStack?: { enabled: boolean };
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        ok ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/10 text-amber-200/90",
      )}
    >
      {ok ?
        <CheckCircle2 className="h-3 w-3" />
      : <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function SettingsSurface() {
  const { user } = useAuth();
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [config, setConfig] = useState<ConfigSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      fetch("/api/connectors/status", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/config").then((r) => r.json()),
    ])
      .then(([conn, cfg]) => {
        setConnectors(conn.connectors ?? []);
        setConfig(cfg);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const envKeys = [
    { name: "DATABASE_URL", purpose: "Ledger + authorizations", required: true },
    { name: "CRON_SECRET", purpose: "Scheduled sensor ticks", required: true },
    { name: "CLAIM_TOKEN_SECRET", purpose: "Signed claim links", required: true },
    { name: "RESEND_API_KEY", purpose: "Earn notifications", required: false },
    { name: "ARC_FUNDING_PRIVATE_KEY", purpose: "On-chain settlement", required: false },
    { name: "GITHUB_TOKEN", purpose: "Code sensor (optional)", required: false },
    { name: "OPENALEX_EMAIL", purpose: "Research sensor politeness", required: false },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <header className="mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Admin
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-2 text-sm text-resolve-muted">
          Connectors, operator keys, and integration health — not a primary tab.
        </p>
      </header>

      <section className="mb-10 border-b border-resolve-border pb-10">
        <div className="mb-4 flex items-center gap-2">
          <Plug className="h-4 w-4 text-resolve-accent" />
          <h2 className="text-sm font-semibold text-white">Connectors</h2>
        </div>
        <p className="mb-4 text-xs text-resolve-muted">
          User connections live here; identity linking stays on{" "}
          <Link href="/profile" className="text-resolve-accent hover:underline">
            Profile
          </Link>
          .
        </p>
        {loading ?
          <p className="text-sm text-resolve-muted">Loading connector status…</p>
        : connectors.length === 0 ?
          <p className="text-sm text-resolve-muted">No connectors configured.</p>
        : <ul className="divide-y divide-resolve-border/60 rounded-xl border border-resolve-border/60">
            {connectors.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{c.label}</p>
                  {c.message && (
                    <p className="mt-0.5 text-xs text-resolve-muted">{c.message}</p>
                  )}
                </div>
                <StatusPill ok={c.connected} label={c.connected ? "Connected" : "Not connected"} />
              </li>
            ))}
          </ul>
        }
      </section>

      <section className="mb-10 border-b border-resolve-border pb-10">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-4 w-4 text-resolve-accent" />
          <h2 className="text-sm font-semibold text-white">Operator keys</h2>
        </div>
        <p className="mb-4 text-xs text-resolve-muted">
          Set on Vercel or Render — values are never exposed to the browser.
        </p>
        <ul className="space-y-2">
          {envKeys.map((k) => (
            <li
              key={k.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <div>
                <p className="font-mono text-xs text-white">{k.name}</p>
                <p className="text-[11px] text-resolve-muted">{k.purpose}</p>
              </div>
              <span className="text-[10px] text-resolve-muted-dim">
                {k.required ? "Required in production" : "Optional"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10 border-b border-resolve-border pb-10">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-resolve-accent" />
          <h2 className="text-sm font-semibold text-white">Platform health</h2>
        </div>
        {config && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] p-4">
              <p className="text-xs text-resolve-muted">LLM reasoning</p>
              <StatusPill ok={Boolean(config.llmEnabled)} label={config.llmEnabled ? "Configured" : "Missing"} />
            </div>
            <div className="rounded-xl border border-white/[0.06] p-4">
              <p className="text-xs text-resolve-muted">Earn email (Resend)</p>
              <StatusPill ok={Boolean(config.resendEnabled)} label={config.resendEnabled ? "Live" : "Off"} />
            </div>
            <div className="rounded-xl border border-white/[0.06] p-4">
              <p className="text-xs text-resolve-muted">Arc settlement</p>
              <StatusPill
                ok={Boolean(config.arcMemos?.canDistributeOnChain)}
                label={config.arcMemos?.canDistributeOnChain ? "On-chain" : "Ledger only"}
              />
              <p className="mt-2 text-[10px] text-resolve-muted">{config.arcMemos?.message}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] p-4">
              <p className="text-xs text-resolve-muted">Gmail OAuth</p>
              <StatusPill
                ok={Boolean(config.integrations?.gmail?.oauthConfigured)}
                label={
                  config.integrations?.gmail?.oauthConfigured ? "OAuth ready" : "Not configured"
                }
              />
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
          Daily ticks run via GitHub Actions{" "}
          <span className="font-mono text-xs text-white/80">cron-daily.yml</span> — POST{" "}
          <span className="font-mono text-xs">/api/cron/tick</span> with{" "}
          <span className="font-mono text-xs">Authorization: Bearer $CRON_SECRET</span>.
        </p>
        <p className="mt-3 text-xs text-resolve-muted-dim">
          Sensor bootstrap: <span className="font-mono">POST /api/cron/bootstrap-sensors</span>{" "}
          (operator only).
        </p>
      </section>
    </div>
  );
}
