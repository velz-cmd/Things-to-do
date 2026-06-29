"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wallet,
  GitBranch,
  LogOut,
  Mail,
  Music,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { toast } from "sonner";
import clsx from "clsx";
import { Money } from "@/components/resolve/ui/money";
import { Button } from "@/components/resolve/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import {
  COMMUNITY_LABELS,
  IDENTITY_PLATFORMS,
  platformsByCommunity,
  type CommunityKind,
  type IdentityPlatformId,
} from "@/lib/profile/community-identities";
import type { ProfileIdentityState } from "@/app/api/profile/identities/route";

const PLATFORM_ICONS: Record<
  IdentityPlatformId,
  React.ComponentType<{ className?: string }>
> = {
  email: Mail,
  github: GitBranch,
  wallet: Wallet,
  listenbrainz: Music,
  navidrome: Music,
  gmail: Mail,
};

function IdentityField({
  icon: Icon,
  value,
  placeholder,
  verified,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value?: string;
  placeholder: string;
  verified?: boolean;
}) {
  return (
    <div className="relative flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0a0f18] px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-resolve-muted" />
      <span
        className={clsx(
          "min-w-0 flex-1 truncate text-sm",
          value ? "text-white" : "text-resolve-muted-dim",
        )}
      >
        {value ?? placeholder}
      </span>
      {verified && (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-label="Verified" />
      )}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-resolve-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 text-xs">{actions}</div>}
    </div>
  );
}

function TextAction({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="font-medium text-resolve-accent hover:underline disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function ConnectNavidromeForm({ onConnected }: { onConnected: () => void }) {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/profile/connect/navidrome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url, username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Connection failed");
      toast.success("Navidrome connected");
      onConnected();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not connect Navidrome");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-2 space-y-2">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://music.example.com"
        type="url"
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none"
        required
      />
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Navidrome username"
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none"
        required
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        type="password"
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none"
        required
      />
      <Button type="submit" size="sm" variant="secondary" disabled={busy}>
        {busy ? "Connecting…" : "Connect Navidrome"}
      </Button>
    </form>
  );
}

export function ProfileSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signOut, signInWithGitHub, linkGitHub, githubEnabled, balance, balanceLoading } =
    useAuth();
  const { openSignIn } = useSignInModal();
  const account = useResolveAccount();
  const capabilities = useAuthCapabilities();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [identityMap, setIdentityMap] = useState<Map<IdentityPlatformId, ProfileIdentityState>>(
    new Map(),
  );
  const [ecosystems, setEcosystems] = useState<
    Array<{ id: string; name: string; kind: string; connectors: string[]; repoCount: number }>
  >([]);
  const [connectingPlatform, setConnectingPlatform] = useState<IdentityPlatformId | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/identities", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) return;
      setEmail(data.email ?? null);
      setEmailVerified(Boolean(data.emailVerified));
      const map = new Map<IdentityPlatformId, ProfileIdentityState>();
      for (const row of (data.identities ?? []) as ProfileIdentityState[]) {
        map.set(row.id, row);
      }
      setIdentityMap(map);
      setEcosystems(data.ecosystems ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, user?.id, account.externalWalletAddress]);

  useEffect(() => {
    if (searchParams.get("gmail_connected") === "1") {
      toast.success("Gmail connected");
      router.replace("/profile");
      void load();
    }
    if (searchParams.get("github_linked") === "1") {
      toast.success("GitHub linked to your account");
      router.replace("/profile");
      void load();
    }
    const gmailError = searchParams.get("gmail_error");
    if (gmailError) {
      toast.error(`Gmail: ${gmailError}`);
      router.replace("/profile");
    }
    if (searchParams.get("listenbrainz_connected") === "1") {
      toast.success("ListenBrainz connected — RESOLVE will sync your listens automatically");
      router.replace("/profile");
      void load();
    }
    const lbError = searchParams.get("listenbrainz_error");
    if (lbError) {
      toast.error(
        lbError === "not_configured"
          ? "ListenBrainz sign-in is not configured on the server yet"
          : `ListenBrainz: ${lbError}`,
      );
      router.replace("/profile");
    }
  }, [searchParams, router, load]);

  async function disconnectPlatform(platform: IdentityPlatformId) {
    const res = await fetch(`/api/profile/connect/${platform}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error((data as { error?: string }).error ?? "Could not disconnect");
      return;
    }
    toast.success("Disconnected");
    void load();
  }

  async function linkGitHubAccount() {
    if (!user) {
      openSignIn();
      return;
    }
    if (githubEnabled && capabilities.github) {
      try {
        await linkGitHub();
      } catch {
        await signInWithGitHub();
      }
      void load();
    } else {
      openSignIn();
    }
  }

  function connectGmail() {
    window.location.href =
      "/api/connectors/gmail/authorize?returnTo=" + encodeURIComponent("/profile");
  }

  function connectListenBrainz() {
    window.location.href =
      "/api/connectors/listenbrainz/authorize?returnTo=" + encodeURIComponent("/profile");
  }

  const byCommunity = useMemo(() => platformsByCommunity(), []);

  const communityOrder: CommunityKind[] = ["open_source", "music", "settlement"];

  function renderPlatformActions(platformId: IdentityPlatformId, connected: boolean) {
    if (platformId === "github") {
      return connected ?
          <>
            <TextAction label="Change" onClick={() => void linkGitHubAccount()} />
            <TextAction
              label="Remove"
              onClick={() => toast.message("Unlink GitHub from your Supabase account settings.")}
            />
          </>
        : null;
    }
    if (platformId === "wallet") {
      return connected ?
          <>
            <TextAction label="Change" onClick={() => open({ view: "Connect" })} />
            <TextAction
              label="Remove"
              onClick={() => {
                disconnect();
                toast.success("Wallet disconnected");
                void load();
              }}
            />
          </>
        : null;
    }
    if (platformId === "gmail") {
      return connected ?
          <>
            <TextAction label="Change" onClick={() => void connectGmail()} />
            <TextAction label="Remove" onClick={() => void disconnectPlatform("gmail")} />
          </>
        : null;
    }
    if (platformId === "listenbrainz" && connected) {
      return (
        <>
          <TextAction label="Reconnect" onClick={() => connectListenBrainz()} />
          <TextAction label="Remove" onClick={() => void disconnectPlatform("listenbrainz")} />
        </>
      );
    }
    if (platformId === "navidrome" && connected) {
      return <TextAction label="Remove" onClick={() => void disconnectPlatform("navidrome")} />;
    }
    return null;
  }

  function renderConnectButton(platformId: IdentityPlatformId, state?: ProfileIdentityState) {
    if (state?.connected) return null;

    switch (platformId) {
      case "github":
        return (
          <Button size="sm" onClick={() => void linkGitHubAccount()}>
            Connect GitHub
          </Button>
        );
      case "wallet":
        return (
          <Button size="sm" onClick={() => open({ view: "Connect" })}>
            Connect wallet
          </Button>
        );
      case "gmail":
        return (
          <Button size="sm" variant="secondary" onClick={() => void connectGmail()}>
            Connect Gmail
          </Button>
        );
      case "navidrome": {
        const listenBrainzOn = identityMap.get("listenbrainz")?.connected;
        return connectingPlatform === "navidrome" ?
            <ConnectNavidromeForm
              onConnected={() => {
                setConnectingPlatform(null);
                void load();
              }}
            />
          : <div className="flex flex-wrap items-center gap-2">
              {!listenBrainzOn && (
                <Button size="sm" onClick={() => connectListenBrainz()}>
                  Connect ListenBrainz
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConnectingPlatform("navidrome")}
              >
                {listenBrainzOn ? "Add server URL" : "Or add server URL"}
              </Button>
            </div>;
      }
      case "listenbrainz":
        return (
          <Button size="sm" onClick={() => connectListenBrainz()}>
            Sign in with MusicBrainz
          </Button>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeader
          title="Email address"
          subtitle="Only visible to you"
          actions={
            user ?
              <>
                <TextAction
                  label="Remove"
                  onClick={async () => {
                    await signOut();
                    router.push("/");
                  }}
                />
                <TextAction label="Change" onClick={() => openSignIn()} />
              </>
            : undefined
          }
        />
        {loading ?
          <div className="flex items-center gap-2 text-sm text-resolve-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        : user && email ?
          <>
            <IdentityField
              icon={Mail}
              value={email}
              placeholder="No email"
              verified={emailVerified}
            />
            <p className="text-[11px] leading-relaxed text-resolve-muted-dim">
              Your email signs you in and anchors your RESOLVE account across communities.
            </p>
          </>
        : <Button variant="secondary" size="sm" onClick={() => openSignIn()}>
            Sign in with email
          </Button>
        }
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-white">Link your community identities</h2>
          <p className="mt-1 max-w-xl text-sm text-resolve-muted">
            One-click connect for each platform — RESOLVE handles attribution and payouts in the
            background. No tokens, scripts, or manual setup.
          </p>
        </div>

        <div className="rounded-xl border border-resolve-accent/20 bg-resolve-accent/[0.06] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-accent">
            Quick connect
          </p>
          <p className="mt-1 text-xs text-resolve-muted">
            GitHub · ListenBrainz · Gmail · Wallet — each uses secure sign-in, like logging into any
            app.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!identityMap.get("github")?.connected && (
              <Button size="sm" variant="secondary" onClick={() => void linkGitHubAccount()}>
                GitHub
              </Button>
            )}
            {!identityMap.get("listenbrainz")?.connected && (
              <Button size="sm" variant="secondary" onClick={() => connectListenBrainz()}>
                ListenBrainz
              </Button>
            )}
            {!identityMap.get("wallet")?.connected && (
              <Button size="sm" variant="secondary" onClick={() => open({ view: "Connect" })}>
                Wallet
              </Button>
            )}
            {(identityMap.get("github")?.connected ||
              identityMap.get("listenbrainz")?.connected ||
              identityMap.get("wallet")?.connected) && (
              <span className="self-center text-xs text-emerald-300/90">
                Connected — earnings sync automatically
              </span>
            )}
          </div>
        </div>

        {communityOrder.map((community) => {
          const platforms = byCommunity.get(community) ?? [];
          if (!platforms.length) return null;

          return (
            <div key={community} className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-resolve-accent">
                {COMMUNITY_LABELS[community]}
              </p>

              {platforms.map((def) => {
                const state = identityMap.get(def.id);
                const Icon = PLATFORM_ICONS[def.id];
                const connected = state?.connected ?? false;
                const display =
                  def.id === "wallet" && account.externalWalletAddress ?
                    `${account.externalWalletAddress.slice(0, 6)}…${account.externalWalletAddress.slice(-4)}`
                  : state?.displayValue;

                return (
                  <div
                    key={def.id}
                    className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <SectionHeader
                      title={def.platform}
                      subtitle={def.usedFor}
                      actions={renderPlatformActions(def.id, connected)}
                    />
                    <p className="text-xs leading-relaxed text-resolve-muted">{def.description}</p>
                    <IdentityField
                      icon={Icon}
                      value={display}
                      placeholder="Not connected"
                      verified={connected && def.status === "live"}
                    />
                    {def.id === "wallet" && connected && (
                      <p className="text-sm font-medium text-white">
                        {balanceLoading ?
                          "Loading balance…"
                        : <>
                            <Money amount={balance?.availableUsd ?? 0} size="sm" className="inline" />{" "}
                            available
                          </>
                        }
                      </p>
                    )}
                    {(state?.eventsToday ?? 0) > 0 && (
                      <p className="text-[11px] text-resolve-muted-dim">
                        {state!.eventsToday} authorization{state!.eventsToday === 1 ? "" : "s"}{" "}
                        today
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {renderConnectButton(def.id, state)}
                      {def.id === "github" && connected && (
                        <Link
                          href="/claim"
                          className="text-xs font-medium text-resolve-accent hover:underline"
                        >
                          View claimable earnings →
                        </Link>
                      )}
                      {def.id === "wallet" && connected && (
                        <Link
                          href="/capital"
                          className="text-xs font-medium text-resolve-accent hover:underline"
                        >
                          Payout preferences →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>

      {ecosystems.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            title="Your communities"
            subtitle="Workspaces you fund or observe — saved to your account"
          />
          <ul className="space-y-2">
            {ecosystems.map((eco) => (
              <li
                key={eco.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#0a0f18] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{eco.name}</p>
                  <p className="text-[11px] text-resolve-muted">
                    {eco.kind} · {eco.repoCount} repo{eco.repoCount === 1 ? "" : "s"}
                    {eco.connectors.length > 0 ?
                      ` · sensors: ${eco.connectors.join(", ")}`
                    : " · connect GitHub to scan repos"}
                  </p>
                </div>
                <Link
                  href="/mission"
                  className="text-xs font-medium text-resolve-accent hover:underline"
                >
                  Open mission →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {user && (
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          className="inline-flex items-center gap-1.5 px-1 text-sm text-resolve-muted transition hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      )}
    </div>
  );
}
