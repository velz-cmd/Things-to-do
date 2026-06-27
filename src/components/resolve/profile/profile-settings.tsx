"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet,
  GitBranch,
  LogOut,
  Mail,
  Music,
  Radio,
  CheckCircle2,
  ExternalLink,
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
  mastodon: Radio,
  peertube: Radio,
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

export function ProfileSettings() {
  const router = useRouter();
  const { user, signOut, signInWithGitHub, githubEnabled, balance, balanceLoading } = useAuth();
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

  async function linkGitHub() {
    if (githubEnabled && capabilities.github) {
      await signInWithGitHub();
      void load();
    } else {
      openSignIn();
    }
  }

  async function connectGmail() {
    window.location.href = "/api/connectors/gmail/authorize";
  }

  const byCommunity = useMemo(() => platformsByCommunity(), []);

  const communityOrder: CommunityKind[] = [
    "open_source",
    "music",
    "settlement",
    "fediverse",
    "video",
  ];

  function renderPlatformActions(platformId: IdentityPlatformId, connected: boolean) {
    if (platformId === "github") {
      return connected ?
          <>
            <TextAction label="Change" onClick={() => void linkGitHub()} />
            <TextAction
              label="Remove"
              onClick={() => toast.message("Disconnect GitHub from Supabase account settings.")}
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
          <TextAction label="Change" onClick={() => void connectGmail()} />
        : null;
    }
    return null;
  }

  function renderConnectButton(platformId: IdentityPlatformId, state?: ProfileIdentityState) {
    if (state?.connected) return null;
    if (IDENTITY_PLATFORMS.find((p) => p.id === platformId)?.status === "upcoming") {
      return (
        <span className="text-xs text-resolve-muted-dim">Coming soon</span>
      );
    }

    switch (platformId) {
      case "github":
        return (
          <Button size="sm" variant="secondary" onClick={() => void linkGitHub()}>
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
      case "navidrome":
        return (
          <Link
            href="https://github.com/velz-cmd/Things-to-do/blob/main/docs/NAVIDROME.md"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-resolve-accent hover:underline"
          >
            Setup guide
            <ExternalLink className="h-3 w-3" />
          </Link>
        );
      case "listenbrainz":
        return (
          <span className="text-xs text-resolve-muted">
            Configure ListenBrainz on your deployment
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-8">
      {/* Email — Galxe-style */}
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

      {/* Community identities */}
      <section className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-white">Link your community identities</h2>
          <p className="mt-1 max-w-xl text-sm text-resolve-muted">
            Each open community connects through its own platform. RESOLVE uses these links for
            attribution and payouts — not as the product itself.
          </p>
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
                  <div key={def.id} className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
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
                          href="/capital"
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

      {/* User's communities / workspaces */}
      {ecosystems.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            title="Your communities"
            subtitle="Workspaces you fund or observe — each uses the identities above"
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
