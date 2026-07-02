"use client";

import clsx from "clsx";
import { GitBranch, Mic2, Radio, Server, Waves } from "lucide-react";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { platformConnected } from "@/lib/profile/connection-state-types";
import { gapsPrimaryActions } from "@/lib/discover/gaps-empty-state";
import { LIVE_SENSOR_RAIL } from "@/lib/discover/sensor-community-rows";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DomainRadarId } from "@/lib/discover/types";
import { DiscoverActionChip } from "@/components/resolve/discover/discover-action-card";

type AttachContext = "gaps" | "radar" | "board";

const RADAR_SENSOR_FILTER: Record<DomainRadarId, string[]> = {
  oss: ["github"],
  music: ["listenbrainz", "musicbrainz", "navidrome", "jellyfin"],
  dao: ["musicbrainz"],
};

const ICONS = {
  github: GitBranch,
  listenbrainz: Mic2,
  musicbrainz: Radio,
  jellyfin: Server,
  navidrome: Waves,
} as const;

function sensorLinked(
  id: string,
  connections: ReturnType<typeof useUserConnections>["state"],
): boolean {
  if (id === "github") return Boolean(connections.githubUsername);
  if (id === "navidrome") return connections.installedCommunitySlugs.includes("navidrome");
  if (id === "jellyfin") return platformConnected(connections, "jellyfin");
  if (id === "listenbrainz") return platformConnected(connections, "listenbrainz");
  if (id === "musicbrainz") return platformConnected(connections, "musicbrainz");
  return false;
}

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

  const sensorIds = radarId
    ? LIVE_SENSOR_RAIL.filter((s) => RADAR_SENSOR_FILTER[radarId].includes(s.id))
    : LIVE_SENSOR_RAIL;

  return (
    <aside
      className={clsx(
        "discover-attach-rail shrink-0 rounded-xl border border-white/[0.08] bg-black/25 p-3",
        "w-full sm:w-[11.5rem]",
        className,
      )}
      aria-label="Value extraction sources"
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
        {context === "board" ? "Extract value" : "Value sources"}
      </p>
      <p className="mt-0.5 text-[9px] leading-relaxed text-resolve-muted-dim">
        Real activity from upstream products — not RESOLVE copy
      </p>

      <ul className="mt-2 space-y-1.5">
        {sensorIds.map((sensor) => {
          const Icon = ICONS[sensor.id as keyof typeof ICONS] ?? GitBranch;
          const linked = sensorLinked(sensor.id, connections);
          return (
            <li
              key={sensor.id}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-white">
                <Icon className="h-3.5 w-3.5 text-sky-400" />
                {sensor.label}
                {linked ? (
                  <span className="ml-auto rounded bg-emerald-500/15 px-1 py-0.5 text-[8px] text-emerald-300">
                    extracting
                  </span>
                ) : (
                  <span className="ml-auto rounded bg-white/[0.04] px-1 py-0.5 text-[8px] text-resolve-muted-dim">
                    idle
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[9px] text-resolve-muted-dim">{sensor.extracts}</p>
              {!linked && (
                <a
                  href={sensor.href}
                  className="mt-1 inline-block text-[10px] font-medium text-sky-400 hover:text-sky-300"
                >
                  Connect →
                </a>
              )}
            </li>
          );
        })}
      </ul>

      {attachActions.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
          <p className="text-[9px] uppercase tracking-wide text-resolve-muted-dim">
            Communities
          </p>
          <p className="text-[9px] text-resolve-muted-dim">Attach once — then fund and operate</p>
          {attachActions.slice(0, 3).map((action, index) => (
            <DiscoverActionChip
              key={`${action.id}-${index}`}
              action={action}
              signedIn={signedIn}
              primary={index === 0}
              surface={`attach-rail-${context}`}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
