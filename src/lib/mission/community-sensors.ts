import type { CommunityKind } from "@/lib/mission/community/types";
import type { ResearchReference } from "@/lib/mission/capabilities/types";
import type { ResolvedSensor } from "@/lib/mission/community/types";
import { hasSensor } from "@/lib/mission/community/sensor-registry";
import { findOpenCollectivesForCommunity, isOpenCollectiveConfigured } from "@/lib/integrations/opencollective";
import { searchCrossref } from "@/lib/integrations/crossref";
import { searchArxiv } from "@/lib/integrations/arxiv";
import { searchOsmPlaces } from "@/lib/integrations/overpass";
import { getDiscordGuildSnapshot, isDiscordConfigured } from "@/lib/integrations/discord";
import { getMastodonAccount, isMastodonConfigured } from "@/lib/integrations/mastodon";

export type CommunitySensorTrace = {
  sensor: string;
  layer: string;
  status: "ok" | "empty";
  summary: string;
};

function ref(title: string, url: string, snippet: string, provider: string): ResearchReference {
  return { title, url, snippet, provider };
}

/** Layer-aware community sensors → chat references + trace summaries. */
export async function collectCommunitySensorReferences(input: {
  question: string;
  communityKind: CommunityKind;
  communityName?: string;
  keywords?: string[];
  sensors: ResolvedSensor[];
}): Promise<{ references: ResearchReference[]; traces: CommunitySensorTrace[] }> {
  const references: ResearchReference[] = [];
  const traces: CommunitySensorTrace[] = [];
  const { communityKind, communityName, keywords = [], sensors } = input;
  const scope = communityName ?? keywords[0] ?? input.question.slice(0, 40);

  if (hasSensor(sensors, "opencollective") && isOpenCollectiveConfigured()) {
    const collectives = await findOpenCollectivesForCommunity(communityName, keywords);
    if (collectives.length) {
      for (const c of collectives) {
        references.push(
          ref(
            c.name,
            c.url,
            c.description?.slice(0, 200) ??
              (c.totalReceivedUsd ?
                `$${Math.round(c.totalReceivedUsd).toLocaleString()} received on Open Collective`
              : "Open Collective community"),
            "Open Collective",
          ),
        );
      }
      traces.push({
        sensor: "opencollective",
        layer: "capital",
        status: "ok",
        summary: `${collectives.length} collective${collectives.length === 1 ? "" : "s"} · ${collectives[0]!.name}`,
      });
    } else {
      traces.push({
        sensor: "opencollective",
        layer: "capital",
        status: "empty",
        summary: "No Open Collective match for this community name yet",
      });
    }
  }

  if (
    hasSensor(sensors, "crossref") &&
    (communityKind === "research" || communityKind === "science" || communityKind === "education")
  ) {
    const works = await searchCrossref(`${scope} ${input.question}`.slice(0, 120), 4);
    for (const w of works) {
      references.push(
        ref(
          w.title,
          w.url,
          w.citations != null ?
            `${w.citations.toLocaleString()} citations${w.published ? ` · ${w.published}` : ""}`
          : "Crossref metadata",
          "Crossref",
        ),
      );
    }
    if (works.length) {
      traces.push({
        sensor: "crossref",
        layer: "observe",
        status: "ok",
        summary: `Crossref · ${works.length} works`,
      });
    }
  }

  if (
    hasSensor(sensors, "arxiv") &&
    (communityKind === "research" || communityKind === "science" || communityKind === "general")
  ) {
    const papers = await searchArxiv({
      communityName,
      question: input.question,
      maxResults: 4,
    });
    for (const p of papers) {
      references.push(
        ref(
          p.title,
          p.url,
          `${p.authors.slice(0, 2).join(", ")}${p.authors.length > 2 ? " et al." : ""} · ${p.summary.slice(0, 120)}…`,
          "arXiv",
        ),
      );
    }
    if (papers.length) {
      traces.push({
        sensor: "arxiv",
        layer: "observe",
        status: "ok",
        summary: `arXiv · ${papers.length} preprints`,
      });
    }
  }

  if (
    hasSensor(sensors, "openstreetmap") &&
    (communityKind === "local" || communityKind === "maps")
  ) {
    const places = await searchOsmPlaces(scope, 4);
    for (const place of places) {
      references.push(
        ref(
          place.name,
          place.lat && place.lon ?
            `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=14/${place.lat}/${place.lon}`
          : "https://www.openstreetmap.org",
          `${place.type} · OpenStreetMap community place`,
          "OpenStreetMap",
        ),
      );
    }
    if (places.length) {
      traces.push({
        sensor: "openstreetmap",
        layer: "observe",
        status: "ok",
        summary: `OSM · ${places.length} mapped places`,
      });
    }
  }

  if (hasSensor(sensors, "discord") && isDiscordConfigured()) {
    const guild = await getDiscordGuildSnapshot();
    if (guild) {
      references.push(
        ref(
          guild.name,
          guild.url ?? `https://discord.com/channels/${guild.id}`,
          guild.memberCount ?
            `${guild.memberCount.toLocaleString()} members · Discord community`
          : "Discord community server",
          "Discord",
        ),
      );
      traces.push({
        sensor: "discord",
        layer: "observe",
        status: "ok",
        summary: `Discord · ${guild.name}`,
      });
    } else {
      traces.push({
        sensor: "discord",
        layer: "observe",
        status: "ok",
        summary: "Discord bot connected · set DISCORD_GUILD_ID for server snapshot",
      });
    }
  }

  if (hasSensor(sensors, "mastodon") && isMastodonConfigured()) {
    const account = await getMastodonAccount();
    if (account) {
      references.push(
        ref(
          `@${account.username}`,
          account.url,
          `${account.followers.toLocaleString()} followers · ${account.displayName}`,
          "Mastodon",
        ),
      );
      traces.push({
        sensor: "mastodon",
        layer: "observe",
        status: "ok",
        summary: `Mastodon · @${account.username}`,
      });
    }
  }

  const seen = new Set<string>();
  const deduped = references.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return { references: deduped.slice(0, 12), traces };
}
