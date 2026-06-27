import { unifiedSearch, isSearchConfigured } from "@/lib/search/providers";
import type { SearchIntent } from "@/lib/search/types";
import type { CommunityKind } from "@/lib/mission/community/types";
import type { ResolvedSensor } from "@/lib/mission/community/types";
import type { ResearchReference } from "@/lib/mission/capabilities/types";
import { collectCommunitySensorReferences } from "@/lib/mission/community-sensors";

export type { ResearchReference };

function searchIntentForKind(kind: CommunityKind): SearchIntent {
  switch (kind) {
    case "oss":
    case "protocol":
      return "github";
    case "research":
    case "science":
    case "education":
      return "docs";
    case "music":
    case "media":
      return "general";
    case "local":
    case "dao":
      return "funding";
    default:
      return "general";
  }
}

function refScore(url: string): number {
  try {
    const h = new URL(url).hostname;
    if (h.includes("github.com")) return 100;
    if (h.includes("opencollective.com")) return 95;
    if (h.includes("openalex.org") || h.includes("crossref.org")) return 90;
    if (h.includes("npmjs.com") || h.includes("pypi.org")) return 85;
    if (h.includes("arxiv.org")) return 80;
  } catch {
    return 0;
  }
  return 10;
}

function mergeReferences(...lists: ResearchReference[][]): ResearchReference[] {
  const seen = new Set<string>();
  const out: ResearchReference[] = [];
  for (const list of lists) {
    for (const r of list) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      out.push(r);
    }
  }
  return out.sort((a, b) => refScore(b.url) - refScore(a.url)).slice(0, 5);
}

/** Web + API research for community discovery. */
export async function researchCommunityQuestion(input: {
  question: string;
  communityKind: CommunityKind;
  communityName?: string;
  keywords?: string[];
  sensors?: ResolvedSensor[];
  maxResults?: number;
}): Promise<{
  references: ResearchReference[];
  provider: string | null;
  query: string;
  sensorTraces: string[];
}> {
  const scope = input.communityName ? `${input.communityName} ` : "";
  const query = `${scope}${input.question}`.trim().slice(0, 400);

  const sensorResult =
    input.sensors?.length ?
      await collectCommunitySensorReferences({
        question: input.question,
        communityKind: input.communityKind,
        communityName: input.communityName,
        keywords: input.keywords,
        sensors: input.sensors,
      })
    : { references: [], traces: [] };

  let webRefs: ResearchReference[] = [];
  let provider: string | null = sensorResult.references.length ? "community-sensors" : null;

  if (isSearchConfigured()) {
    try {
      const response = await unifiedSearch(query, {
        maxResults: input.maxResults ?? 5,
        intent: searchIntentForKind(input.communityKind),
      });
      webRefs = response.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        provider: r.source,
      }));
      provider = provider ? `${provider}+${response.provider}` : response.provider;
    } catch {
      /* sensor refs still useful */
    }
  }

  return {
    query,
    provider,
    references: mergeReferences(sensorResult.references, webRefs),
    sensorTraces: sensorResult.traces.map((t) => t.summary),
  };
}
