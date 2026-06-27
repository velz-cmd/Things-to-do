import { unifiedSearch, isSearchConfigured } from "@/lib/search/providers";
import type { SearchIntent } from "@/lib/search/types";
import type { CommunityKind } from "@/lib/mission/community/types";

export type ResearchReference = {
  title: string;
  url: string;
  snippet: string;
  provider: string;
};

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

/** Web research for community discovery — Tavily → Serper → WebSearch fallback. */
export async function researchCommunityQuestion(input: {
  question: string;
  communityKind: CommunityKind;
  communityName?: string;
  maxResults?: number;
}): Promise<{
  references: ResearchReference[];
  provider: string | null;
  query: string;
}> {
  if (!isSearchConfigured()) {
    return { references: [], provider: null, query: input.question };
  }

  const scope = input.communityName ? `${input.communityName} ` : "";
  const query = `${scope}${input.question}`.trim().slice(0, 400);

  try {
    const response = await unifiedSearch(query, {
      maxResults: input.maxResults ?? 5,
      intent: searchIntentForKind(input.communityKind),
    });

    return {
      query,
      provider: response.provider,
      references: response.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        provider: r.source,
      })),
    };
  } catch {
    return { references: [], provider: null, query };
  }
}
