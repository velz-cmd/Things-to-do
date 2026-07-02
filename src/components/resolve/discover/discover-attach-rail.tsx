"use client";

import clsx from "clsx";
import { GitBranch, Mic2, Radio } from "lucide-react";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { platformConnected } from "@/lib/profile/connection-state-types";
import { gapsPrimaryActions } from "@/lib/discover/gaps-empty-state";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DomainRadarId } from "@/lib/discover/types";
import { DiscoverActionChip } from "@/components/resolve/discover/discover-action-card";

type AttachContext = "gaps" | "radar" | "board";

const RADAR_CONNECTOR: Record<DomainRadarId, { label: string; platform: "github" | "listenbrainz" | "musicbrainz" }> = {
  oss: { label: "GitHub", platform: "github" },
  music: { label: "ListenBrainz", platform: "listenbrainz" },
  dao: { label: "MusicBrainz", platform: "musicbrainz" },
};

export function DiscoverAttachRail({
  context,
  radarId,
  role = "all",
  needType = "all",
  signedIn,
  className,
}: {
  context: AttachContext;
  radarId?: DomainRadarId;
  role?: DiscoverRole;
  needType?: DiscoverNeedTypeFilter;
  signedIn: boolean;
  className?: string;
}) {
  const { state: connections } = useUserConnections();
  const attachActions = gapsPrimaryActions({
    needType,
    role,
    installedSlugs: connections.installedCommunitySlugs,
  });

  const connector =
    radarId != null ? RADAR_CONNECTOR[radarId] : { label: "GitHub", platform: "github" as const };

  const githubConnected = Boolean(connections.githubUsername);
  const sensorConnected =
    connector.platform === "github"
      ? githubConnected
      : platformConnected(connections, connector.platform);

  const primaryAttach = attachActions[0];

  return (
    <aside
      className={clsx(
        "discover-attach-rail shrink-0 rounded-xl border border-white/[0.08] bg-black/25 p-3",
        "w-full sm:w-[11.5rem]",
        className,
      )}
      aria-label="Attach sensors and communities"
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
        {context === "board" ? "Unlock board" : "Attach first"}
      </p>

      <div className="mt-2 space-y-2">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-white">
            {connector.platform === "github" ? (
              <GitBranch className="h-3.5 w-3.5 text-sky-400" />
            ) : connector.platform === "listenbrainz" ? (
              <Mic2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Radio className="h-3.5 w-3.5 text-indigo-400" />
            )}
            {connector.label}
          </div>
          <p className="mt-1 text-[10px] leading-snug text-resolve-muted-dim">
            {sensorConnected
              ? connector.platform === "github"
                ? `@${connections.githubUsername}`
                : "Sensor linked"
              : `Connect ${connector.label} on Profile`}
          </p>
          {!sensorConnected && (
            <a
              href={
                connector.platform === "github"
                  ? "/connect/github"
                  : connector.platform === "listenbrainz"
                    ? "/connect/listenbrainz"
                    : "/profile"
              }
              className="mt-1.5 inline-block text-[10px] font-medium text-sky-400 hover:text-sky-300"
            >
              Connect {connector.label} →
            </a>
          )}
        </div>

        {primaryAttach && (
          <div className="rounded-lg border border-resolve-accent/20 bg-resolve-accent/5 px-2 py-2">
            <p className="text-[9px] uppercase tracking-wide text-resolve-muted-dim">Community</p>
            <div className="mt-1.5">
              <DiscoverActionChip
                action={primaryAttach}
                signedIn={signedIn}
                primary
                surface={`attach-rail-${context}`}
              />
            </div>
          </div>
        )}

        {attachActions.slice(1, 3).map((action, index) => (
          <DiscoverActionChip
            key={`${action.id}-${index}`}
            action={action}
            signedIn={signedIn}
            surface={`attach-rail-${context}-alt`}
          />
        ))}
      </div>
    </aside>
  );
}
