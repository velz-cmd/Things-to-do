"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { apiInstallCommunity } from "@/lib/discover/discover-action-engine";
import { ACTION_STATUS } from "@/lib/copy/action-status";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { communityLinkedViaProfile } from "@/lib/discover/community-profile-link";
import type { CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { CommunityVitalsSummary } from "@/lib/communities/types";
import { CommunityDomainIcon, communityOperationsDescription } from "./community-identity";
import styles from "./communities.module.css";

type Props = {
  community: Pick<CommunityCatalogEntry, "slug" | "name" | "tagline" | "installCta" | "attachShape" | "upstream" | "kind">;
  installed?: boolean;
  vitals?: CommunityVitalsSummary | null;
  compact?: boolean;
  onInstalled?: (observeNarrative?: string) => void;
};

export function InstallResolveCard({ community, installed = false, vitals = null, compact = false, onInstalled }: Props) {
  const [busy, setBusy] = useState(false);
  const [attached, setAttached] = useState(false);
  const { refreshSync, state: connections } = useUserConnections();
  const profileReady = communityLinkedViaProfile(community.slug, connections);
  const showInstalled = installed || profileReady || attached;

  async function install() {
    setBusy(true);
    try {
      const data = await apiInstallCommunity(community.slug);
      const narrative = vitals?.observeNarrative ?? `Connected to ${community.name}.`;
      setAttached(true);
      toast.success(data.alreadyInstalled ? `${community.name} is already installed` : `${community.name} installed`, {
        description: "Open the console to synchronize sources and configure policy.",
      });
      onInstalled?.(narrative);
      void refreshSync().catch(() => null);
    } catch (error) {
      toast.message(error instanceof Error ? error.message : ACTION_STATUS.workingInstall, {
        description: "Check the Communities console—the installation may already be complete.",
      });
      void refreshSync().catch(() => null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={styles.installCard} data-compact={compact || undefined} data-kind={community.kind}>
      <div className={styles.installIdentity}>
        <span className={styles.domainIcon}><CommunityDomainIcon slug={community.slug} kind={community.kind} /></span>
        <div><h3>{community.name}</h3><p>{community.upstream}</p></div>
        <span className={styles.attachBadge}>{community.attachShape}</span>
      </div>
      {!compact && <p className={styles.installCopy}>{communityOperationsDescription(community.kind)}</p>}
      <div className={styles.installHealth}>
        <span><i data-active={vitals?.sensor.ready || undefined} />Connector availability</span>
        <strong>{vitals?.sensor.ready ? "Available" : "Platform setup pending"}</strong>
      </div>
      {showInstalled ? (
        <Link data-action-id="community.open" href={`/communities/${community.slug}`} className={styles.cardPrimary}>
          <CheckCircle2 /> Open console <ArrowRight />
        </Link>
      ) : (
        <button data-action-id="community.install" type="button" className={styles.cardPrimary} disabled={busy} onClick={() => void install()}>
          {busy ? <Loader2 className="animate-spin" /> : <PlugZap />} {busy ? "Installing…" : "Install ecosystem"}
        </button>
      )}
    </article>
  );
}
