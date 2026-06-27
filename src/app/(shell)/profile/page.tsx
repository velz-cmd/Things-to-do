"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet,
  GitBranch,
  LogOut,
  Plug,
  Bell,
  User,
  Music,
  Globe,
  ChevronRight,
} from "lucide-react";
import { useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { toast } from "sonner";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Money } from "@/components/resolve/ui/money";
import { Button } from "@/components/resolve/ui/button";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";

function IdentityCard({
  icon: Icon,
  title,
  description,
  children,
  href,
  hrefLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <BlueGlowCard className="p-0 transition" padding={false} hover>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-resolve-lg border border-resolve-border bg-resolve-raised/80">
            <Icon className="h-4 w-4 text-resolve-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-resolve-muted">{description}</p>
            {children && <div className="mt-4">{children}</div>}
            {href && hrefLabel && (
              <Link
                href={href}
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-resolve-accent hover:underline"
              >
                {hrefLabel}
                <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </BlueGlowCard>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut, signInWithGitHub, githubEnabled, balance, balanceLoading } = useAuth();
  const { openSignIn } = useSignInModal();
  const account = useResolveAccount();
  const capabilities = useAuthCapabilities();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();

  async function linkGitHub() {
    if (githubEnabled && capabilities.github) {
      await signInWithGitHub();
    } else {
      openSignIn();
    }
  }

  return (
    <ProductPage
      icon={User}
      title="Who am I in this network?"
      description="Universal identity — wallets, communities, connected ecosystems, and payout preferences. GitHub and MusicBrainz are identities, not the product."
      workflows={[
        { label: "GitHub" },
        { label: "Wallet" },
        { label: "MusicBrainz" },
        { label: "Payout prefs" },
      ]}
      width="narrow"
      accent="blue"
    >
      <div className="space-y-4">
        <BlueGlowCard className="border border-resolve-accent/20 p-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-resolve-muted">
            Account
          </p>
          {user ?
            <p className="mt-2 text-base font-medium text-white">{user.email ?? "Signed in"}</p>
          : <Button variant="ghost" className="mt-2 px-0" onClick={() => openSignIn()}>
              Sign in to RESOLVE
            </Button>
          }
        </BlueGlowCard>

        <IdentityCard
          icon={GitBranch}
          title="GitHub"
          description="Required to claim authorizations as a contributor. Links your code identity to RESOLVE."
        >
          <Button variant="secondary" size="sm" onClick={() => void linkGitHub()}>
            {user ? "Manage GitHub" : "Connect GitHub"}
          </Button>
        </IdentityCard>

        <IdentityCard
          icon={Wallet}
          title="Wallet"
          description="Receive settlements and claim authorized earnings on Arc."
        >
          <p className="text-sm font-semibold text-white">
            {balanceLoading ?
              "Loading…"
            : <>
                <Money amount={balance?.availableUsd ?? 0} size="sm" className="inline" /> available
              </>
            }
          </p>
          {account.externalWalletAddress && (
            <p className="mt-1 font-mono text-xs text-resolve-muted">
              {account.externalWalletAddress.slice(0, 8)}…{account.externalWalletAddress.slice(-6)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => open({ view: "Connect" })}>
              {account.externalWalletAddress ? "Switch wallet" : "Connect wallet"}
            </Button>
            {account.externalWalletAddress && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  disconnect();
                  toast.success("Wallet disconnected");
                }}
              >
                Disconnect
              </Button>
            )}
          </div>
        </IdentityCard>

        <IdentityCard
          icon={Music}
          title="Music & creative identity"
          description="MusicBrainz credits, ListenBrainz scrobbles, and Navidrome sync — attribution for creative work."
          href="/activity"
          hrefLabel="View music connectors"
        />

        <IdentityCard
          icon={Plug}
          title="Connectors"
          description={`Gmail ${account.gmailInboxConnected ? "connected" : "not connected"} · Arc ${account.arcConnected ? "ready" : "off-chain mode"}`}
          href="/activity"
          hrefLabel="Manage connectors"
        />

        <IdentityCard
          icon={Globe}
          title="Payout preferences"
          description="Configure currency and claim destination on the Payments surface."
          href="/payments"
          hrefLabel="Open payments"
        />

        <IdentityCard
          icon={Bell}
          title="Notifications"
          description="Settlement and claim alerts when new authorizations arrive."
        />

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
    </ProductPage>
  );
}
