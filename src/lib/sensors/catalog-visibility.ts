import { COMMUNITY_CATALOG, type CommunityCatalogEntry } from "@/lib/communities/catalog";

export type CommunitySensorStatus = {
  slug: string;
  sensorGated: boolean;
  sensorLive: boolean;
  sensorReady: boolean;
  message: string;
};

/** Catalog browse filter — vision rule: hide sensor-gated communities until live. */
export function listBrowsableCommunities(
  statuses: CommunitySensorStatus[],
): CommunityCatalogEntry[] {
  const statusMap = new Map(statuses.map((s) => [s.slug, s]));

  return COMMUNITY_CATALOG.filter((entry) => {
    const status = statusMap.get(entry.slug);
    if (!status?.sensorGated) return true;
    return status.sensorLive;
  });
}
