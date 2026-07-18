"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Activity, ArrowRight, Check, CircleAlert, Fingerprint, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import {
  EconomicEntry,
  IdentityList,
  IdentityNetwork,
  ProfileControlPlaneSkeleton,
  ReadinessMap,
  Relationships,
  Sources,
  Wallets,
  WorkAndClaims,
  type ProfileTab,
} from "@/components/resolve/profile/profile-control-plane";
import type { ProfileBootstrap } from "@/lib/profile/control-plane-bootstrap";
import { useProfileBootstrapQuery } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";

type VisibleTab = Exclude<ProfileTab, "security" | "activity">;

const TABS: Array<{ id: VisibleTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "identities", label: "Identities" },
  { id: "sources", label: "Sources" },
  { id: "work", label: "Work & claims" },
  { id: "wallets", label: "Wallets & payout" },
  { id: "relationships", label: "Relationships" },
  { id: "account", label: "Account" },
];

const ALIASES: Record<string, VisibleTab> = {
  identity: "identities",
  connections: "sources",
  work: "work",
  claims: "work",
  wallet: "wallets",
  payouts: "wallets",
  security: "account",
  activity: "account",
};

const panel = "rounded-2xl border border-white/[0.08] bg-[#091321]";
const button = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-xs font-medium text-slate-200 transition hover:border-cyan-300/30 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:cursor-wait disabled:opacity-60";

function relativeTime(value: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return `${new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(parsed)} UTC`;
}

function State({ ready, label }: { ready: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${ready ? "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-300" : "border-amber-300/20 bg-amber-300/[0.08] text-amber-200"}`}>
      {ready ? <Check className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
      {label}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/[0.1] px-4 py-7 text-center text-sm text-slate-500">{children}</div>;
}

function AccountView({ data, signOut }: { data: ProfileBootstrap; signOut: () => Promise<void> }) {
  const securityRows = [
    ["Active sessions", String(data.security.activeSessions)],
    ["Last sign-in", relativeTime(data.security.lastSignInAt)],
    ["Authentication", data.security.authenticationMethod],
    ["Two-factor", data.security.twoFactorConfigured === null ? "Not reported by provider" : data.security.twoFactorConfigured ? "Configured" : "Not configured"],
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <section className={`${panel} p-5`}>
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-rose-300" />
          <div>
            <h2 className="text-lg font-semibold text-white">Access & security</h2>
            <p className="text-xs text-slate-500">Provider-reported account state only.</p>
          </div>
        </div>
        <dl className="mt-5 grid gap-2 sm:grid-cols-2">
          {securityRows.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/[0.07] bg-[#07101c] p-4">
              <dt className="text-[10px] uppercase tracking-wider text-slate-600">{label}</dt>
              <dd className="mt-2 text-sm text-slate-200">{value}</dd>
            </div>
          ))}
        </dl>
        <button type="button" onClick={() => void signOut()} className={`${button} mt-4 text-rose-200`}>
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </section>
      <section className={`${panel} p-5`}>
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-cyan-300" />
          <div>
            <h2 className="text-lg font-semibold text-white">Account activity</h2>
            <p className="text-xs text-slate-500">Identity, connection, wallet, payout, and access events.</p>
          </div>
        </div>
        <div className="mt-5 divide-y divide-white/[0.06]">
          {data.activity.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-200">{row.label}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-slate-600">{row.eventType}</p>
              </div>
              <time className="shrink-0 text-xs text-slate-500">{relativeTime(row.occurredAt)}</time>
            </div>
          ))}
          {data.activity.length === 0 && <Empty>No account-level activity has been recorded.</Empty>}
        </div>
      </section>
    </div>
  );
}

export function ProfilePassport({ initialData }: { initialData: ProfileBootstrap | null }) {
  const { user, signOut } = useAuth();
  const { openSignIn } = useSignInModal();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const query = useProfileBootstrapQuery(Boolean(user || initialData), initialData);
  const data = query.data ?? initialData;
  const requested = params.get("view") ?? ALIASES[params.get("section") ?? ""];
  const active: VisibleTab = TABS.some((tab) => tab.id === requested)
    ? requested as VisibleTab
    : "overview";
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const select = (tab: ProfileTab) => {
    const visible = tab === "security" || tab === "activity" ? "account" : tab;
    const next = new URLSearchParams(params.toString());
    next.set("view", visible);
    next.delete("section");
    router.replace(`/profile?${next.toString()}`, { scroll: false });
  };
  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.profileBootstrap });
    await query.refetch();
  };
  const refresh = async (provider: string) => {
    setBusy(provider);
    setNotice(null);
    try {
      const response = await fetch("/api/profile/connections", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ provider }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Source synchronization failed");
      await reload();
      setNotice(`${provider} synchronized from its persisted source connection.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Source synchronization failed");
    } finally {
      setBusy(null);
    }
  };
  const disconnect = async (provider: string) => {
    if (!window.confirm(`Disconnect ${provider}? New evidence from this source will stop synchronizing.`)) return;
    setBusy(provider);
    setNotice(null);
    try {
      const response = await fetch(`/api/profile/connect/${provider}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "idempotency-key": crypto.randomUUID() },
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Source disconnection failed");
      await reload();
      setNotice(`${provider} disconnected.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Source disconnection failed");
    } finally {
      setBusy(null);
    }
  };
  const setPayout = async (walletType: "app" | "external") => {
    const label = walletType === "app" ? "RESOLVE wallet" : "connected wallet";
    if (!window.confirm(`Use the ${label} as your payout destination?`)) return;
    setBusy(`payout:${walletType}`);
    setNotice(null);
    try {
      const response = await fetch("/api/profile/payout-destination", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletType, confirm: true, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; status?: string };
      if (!response.ok) throw new Error(payload.error ?? "Payout destination was not updated");
      await reload();
      setNotice(payload.status === "verified" ? `${label} is now the verified payout destination.` : `${label} is pending ownership proof.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Payout destination update failed");
    } finally {
      setBusy(null);
    }
  };

  if (!user && !initialData) {
    return (
      <main className="min-h-[70vh] bg-[#040811] px-4 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-[#091321] p-8 text-center">
          <UserRound className="mx-auto h-8 w-8 text-violet-300" />
          <h1 className="mt-4 text-2xl font-semibold text-white">Your identity control plane</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to manage attribution, sources, relationships, and payout readiness.</p>
          <button type="button" onClick={openSignIn} className={`${button} mt-6`}>Sign in</button>
        </div>
      </main>
    );
  }
  if (!data) return <ProfileControlPlaneSkeleton />;

  const connectedCount = data.connections.filter((row) => row.status === "connected").length;
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,rgba(130,103,244,0.12),transparent_28%),linear-gradient(180deg,#040811,#050a12)] px-4 py-5 text-slate-200 sm:px-6">
      <div className="mx-auto max-w-[1320px]">
        <header className={`${panel} overflow-hidden p-5 sm:p-6`}>
          <div className="flex flex-wrap items-center gap-5">
            {data.user.avatarUrl ? (
              <Image unoptimized src={data.user.avatarUrl} alt="" width={64} height={64} className="h-16 w-16 rounded-2xl border border-violet-300/20 object-cover" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-xl font-semibold text-violet-200">{(data.user.displayName ?? data.user.email ?? "R").slice(0, 1).toUpperCase()}</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300">RESOLVE passport</p>
              <h1 className="mt-1 truncate text-2xl font-semibold text-white">{data.user.displayName ?? data.user.email ?? "RESOLVE account"}</h1>
              <p className="mt-1 truncate text-sm text-slate-400">{data.user.handle ? `@${data.user.handle} · ` : ""}{data.user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <State ready={data.user.emailVerified} label={data.user.emailVerified ? "Verified account" : "Email attention"} />
              <State ready={connectedCount > 0} label={`${connectedCount} connected sources`} />
              <State ready={data.readiness.payoutReady} label={data.readiness.payoutReady ? "Payout ready" : "Payout attention"} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <p className="max-w-3xl text-sm leading-6 text-slate-400">One calm control plane for attribution, evidence sources, verified work, ecosystem relationships, and the destination where recognized value can settle.</p>
            <div className="flex flex-wrap gap-1.5">{data.roles.map((role) => <span key={role} className="rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-2.5 py-1 text-[10px] font-medium text-violet-200">{role}</span>)}{data.roles.length === 0 && <span className="text-xs text-slate-600">Roles appear from verified activity.</span>}</div>
          </div>
        </header>

        <nav aria-label="Profile sections" role="tablist" className="mt-4 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#07101c] p-1">
          {TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} onClick={() => select(tab.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${active === tab.id ? "bg-violet-400/15 text-violet-100 ring-1 ring-violet-300/20" : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"}`}>{tab.label}</button>)}
        </nav>
        {notice && <div role="status" className="mt-3 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.05] px-3 py-2 text-xs text-cyan-100">{notice}</div>}

        <div className="mt-4 space-y-4">
          {active === "overview" && <><ReadinessMap data={data} select={select} /><div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]"><IdentityNetwork identities={data.identities} payout={data.wallets.payoutDestination} /><section className={`${panel} p-5`}><h2 className="text-sm font-semibold text-white">Recent account activity</h2><div className="mt-4 space-y-2">{data.activity.slice(0, 5).map((row) => <div key={row.id} className="rounded-lg bg-[#07101c] px-3 py-2"><p className="text-xs text-slate-300">{row.label}</p><span className="text-[10px] text-slate-600">{relativeTime(row.occurredAt)}</span></div>)}{data.activity.length === 0 && <Empty>No account-level events have been recorded.</Empty>}</div></section></div><EconomicEntry data={data} /></>}
          {active === "identities" && <><IdentityNetwork identities={data.identities} payout={data.wallets.payoutDestination} /><IdentityList rows={data.identities} /></>}
          {active === "sources" && <Sources rows={data.connections} busy={busy} onRefresh={refresh} onDisconnect={disconnect} />}
          {active === "work" && <WorkAndClaims data={data} />}
          {active === "wallets" && <Wallets data={data} busy={busy} onSetPayout={setPayout} />}
          {active === "relationships" && <Relationships data={data} />}
          {active === "account" && <AccountView data={data} signOut={signOut} />}
        </div>
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1 text-[10px] uppercase tracking-[0.16em] text-slate-600"><span>Persisted connection state · {data.freshness.connectionState}</span><span>Generated {relativeTime(data.freshness.generatedAt)}</span></footer>
      </div>
    </main>
  );
}
