import { env, INTEGRATIONS } from "@/lib/integrations/config";
import { EntityIds } from "@/lib/domain/entities";
import type { Observation } from "@/lib/domain/observation";
import { bayesianPayeeConfidence } from "@/lib/sensors/confidence";
import { sensorProofHash } from "@/lib/sensors/proof";
import type { SensorProgramContext } from "@/lib/sensors/program-context";
import { OPEN_RESEARCH_QUERIES } from "@/lib/sensors/targets";

type OpenAlexWork = {
  id: string;
  title: string;
  cited_by_count: number;
  publication_year?: number;
  authorships?: Array<{
    author: { id: string; display_name: string };
  }>;
};

function openAlexHeaders(): HeadersInit {
  const key = env("OPENALEX_API_KEY");
  return {
    Accept: "application/json",
    "User-Agent": "RESOLVE/1.0 (mailto:resolve@arc.network)",
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };
}

function openAlexUrl(path: string, params: Record<string, string>): string {
  const key = env("OPENALEX_API_KEY");
  const qs = new URLSearchParams(params);
  if (key) qs.set("api_key", key);
  return `https://api.openalex.org${path}?${qs}`;
}

async function fetchOpenAlexWorks(query: string, perPage = 5): Promise<OpenAlexWork[]> {
  const url = openAlexUrl("/works", {
    search: query,
    per_page: String(perPage),
    sort: "cited_by_count:desc",
  });
  const res = await fetch(url, { headers: openAlexHeaders(), next: { revalidate: 86400 } });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: OpenAlexWork[] };
  return json.results ?? [];
}

async function fetchCitingWorks(workId: string, perPage = 3): Promise<OpenAlexWork[]> {
  const shortId = workId.replace("https://openalex.org/", "");
  const url = openAlexUrl("/works", {
    filter: `cites:${shortId}`,
    per_page: String(perPage),
    sort: "publication_date:desc",
  });
  const res = await fetch(url, { headers: openAlexHeaders(), next: { revalidate: 86400 } });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: OpenAlexWork[] };
  return json.results ?? [];
}

function workEntityId(openAlexId: string): string {
  const short = openAlexId.replace("https://openalex.org/", "");
  return EntityIds.workOpenAlex(short);
}

/** OpenAlex sensor — verified citations → observations (RFB #2). */
export async function scanCitationObservations(input: {
  program: SensorProgramContext;
  queries?: string[];
  worksPerQuery?: number;
  citationsPerWork?: number;
}): Promise<Observation[]> {
  if (!INTEGRATIONS.openAlex()) return [];

  const queries = input.queries ?? OPEN_RESEARCH_QUERIES;
  const observations: Observation[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const works = await fetchOpenAlexWorks(query, input.worksPerQuery ?? 3);
    for (const cited of works) {
      if ((cited.cited_by_count ?? 0) < 1) continue;

      const citingWorks = await fetchCitingWorks(cited.id, input.citationsPerWork ?? 2);
      const payee = cited.authorships?.[0]?.author;
      if (!payee) continue;

      const citedId = workEntityId(cited.id);

      for (const citing of citingWorks) {
        const idempotencyKey = `openalex:cite:${cited.id}:${citing.id}`;
        if (seen.has(idempotencyKey)) continue;
        seen.add(idempotencyKey);

        const { confidence } = bayesianPayeeConfidence({
          sensorQuality: 0.88,
          proofStrength: 0.82,
          corroboration: (citing.cited_by_count ?? 0) > 0 ? 0.75 : 0.55,
        });

        observations.push({
          id: idempotencyKey,
          idempotencyKey,
          connectorId: "openalex",
          kind: "research_citation",
          observedAt: new Date().toISOString(),
          actor: {
            type: "person",
            id: `person:openalex:${payee.id.replace("https://openalex.org/", "")}`,
            label: payee.display_name,
          },
          subject: {
            type: "work",
            id: citedId,
            label: cited.title,
          },
          object: {
            type: "work",
            id: workEntityId(citing.id),
            label: citing.title,
          },
          metrics: {
            citations: cited.cited_by_count ?? 1,
            amount_hint_usd: input.program.rules.perCitationUsd ?? 0.05,
          },
          confidence,
          proofHash: sensorProofHash(idempotencyKey),
          evidenceRefs: [cited.id, citing.id],
          raw: {
            citedTitle: cited.title,
            citingTitle: citing.title,
            publicationYear: cited.publication_year,
          },
          missionId: input.program.missionId,
          policyId: input.program.templateId,
        });
      }
    }
  }

  return observations;
}
