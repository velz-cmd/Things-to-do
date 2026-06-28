import { COMMUNITY_CATALOG, type CommunityCatalogEntry } from "@/lib/communities/catalog";
import { communityHasLiveSensorEvents } from "@/lib/sensors/sync";
import { hasGithubToken } from "@/lib/github/client";
import { INTEGRATIONS } from "@/lib/integrations/config";
import {
  listBrowsableCommunities,
  type CommunitySensorStatus,
} from "@/lib/sensors/catalog-visibility";

export type { CommunitySensorStatus } from "@/lib/sensors/catalog-visibility";
export { listBrowsableCommunities } from "@/lib/sensors/catalog-visibility";

function sensorGated(slug: string): boolean {
  return ["react", "linux", "open-research"].includes(slug);
}

function sensorReadyForSlug(slug: string): boolean {
  if (slug === "open-research") return INTEGRATIONS.openAlex();
  if (slug === "react" || slug === "linux") return hasGithubToken();
  return true;
}

export async function getCommunitySensorStatuses(): Promise<CommunitySensorStatus[]> {
  const statuses: CommunitySensorStatus[] = [];

  for (const entry of COMMUNITY_CATALOG) {
    const gated = sensorGated(entry.slug);
    const ready = sensorReadyForSlug(entry.slug);
    const live = gated ? await communityHasLiveSensorEvents(entry.slug) : true;

    let message = "Live sensor events in ledger";
    if (gated && !ready) {
      message =
        entry.slug === "open-research"
          ? "Awaiting OPENALEX_API_KEY"
          : entry.slug === "react" || entry.slug === "linux"
            ? "Awaiting GITHUB_TOKEN"
            : "Sensor not configured";
    } else if (gated && !live) {
      message = "Sensor gated — run sync to produce real authorizations before catalog visibility";
    }

    statuses.push({
      slug: entry.slug,
      sensorGated: gated,
      sensorLive: live,
      sensorReady: ready,
      message,
    });
  }

  return statuses;
}

export async function getBrowsableCommunities(): Promise<CommunityCatalogEntry[]> {
  const statuses = await getCommunitySensorStatuses();
  return listBrowsableCommunities(statuses);
}
