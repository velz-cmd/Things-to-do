"use client";

import clsx from "clsx";
import Link from "next/link";
import { GitBranch, Mic2, Radio, Server, Waves } from "lucide-react";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { platformConnected } from "@/lib/profile/connection-state-types";
import { LIVE_SENSOR_RAIL } from "@/lib/discover/sensor-community-rows";
import type { DomainRadarId } from "@/lib/discover/types";

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

/** Empty-state helper — connections are managed once in Profile. */
export function DiscoverAttachRail({
  context: _context,
  radarId,
  className,
}: {
  context: AttachContext;
  radarId?: DomainRadarId;
  role?: import("@/lib/discover/role-filters").DiscoverRole;
  needType?: import("@/lib/discover/need-types").DiscoverNeedTypeFilter;
  signedIn?: boolean;
  className?: string;
}) {
  const { state: connections } = useUserConnections();

  const sensorIds = radarId
    ? LIVE_SENSOR_RAIL.filter((s) => RADAR_SENSOR_FILTER[radarId].includes(s.id))
    : LIVE_SENSOR_RAIL;

  const unlinked = sensorIds.filter((sensor) => !sensorLinked(sensor.id, connections));

  if (unlinked.length === 0) {
    return (
      <aside
        className={clsx(
          "discover-attach-rail shrink-0 rounded-xl border border-white/[0.08] bg-black/25 p-3",
          "w-full sm:w-[11.5rem]",
          className,
        )}
        aria-label="Linked sources"
      >
        <p className="text-[10px] font-medium text-white">Sources linked</p>
        <p className="mt-1 text-[9px] text-resolve-muted-dim">
          Profile connections sync across Discover, Communities, and Capital.
        </p>
        <Link
          href="/profile"
          className="mt-2 inline-block text-[10px] font-medium text-sky-400 hover:text-sky-300"
        >
          Manage in Profile →
        </Link>
      </aside>
    );
  }

  return (
    <aside
      className={clsx(
        "discover-attach-rail shrink-0 rounded-xl border border-white/[0.08] bg-black/25 p-3",
        "w-full sm:w-[11.5rem]",
        className,
      )}
      aria-label="Link sources"
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
        Link once in Profile
      </p>
      <p className="mt-0.5 text-[9px] leading-relaxed text-resolve-muted-dim">
        Syncs everywhere — no repeat setup per tab
      </p>

      <ul className="mt-2 space-y-1.5">
        {unlinked.map((sensor) => {
          const Icon = ICONS[sensor.id as keyof typeof ICONS] ?? GitBranch;
          return (
            <li
              key={sensor.id}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-white">
                <Icon className="h-3.5 w-3.5 text-sky-400" />
                {sensor.label}
              </div>
              <p className="mt-0.5 text-[9px] text-resolve-muted-dim">{sensor.extracts}</p>
              <Link
                href="/profile"
                className="mt-1 inline-block text-[10px] font-medium text-sky-400 hover:text-sky-300"
              >
                Link in Profile →
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
