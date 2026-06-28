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
    sort: "publication_date:desc",
    filter: "publication_year:>2023",
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

function workEntityId(openAlexShortId: string): string {
  return EntityIds.workOpenAlex(openAlexShortId);
}

function openAlexShortId(id: string | null | undefined): string | null {
  if (!id) return null;
  return id.replace("https://openalex.org/", "");
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
      const citedShort = openAlexShortId(cited.id);
      if (!citedShort) continue;

      const citingWorks = await fetchCitingWorks(cited.id, input.citationsPerWork ?? 2);
      const payee = cited.authorships?.[0]?.author;
      if (!payee?.display_name) continue;

      const payeeShort =
        openAlexShortId(payee.id) ??
        payee.display_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
      const citedId = workEntityId(citedShort);

      for (const citing of citingWorks) {
        const citingShort = openAlexShortId(citing.id);
        if (!citingShort) continue;

        const idempotencyKey = `openalex:cite:${citedShort}:${citingShort}`;
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
            id: `person:openalex:${payeeShort}`,
            label: payee.display_name,
          },
          subject: {
            type: "work",
            id: citedId,
            label: cited.title,
          },
          object: {
            type: "work",
            id: workEntityId(citingShort),
            label: citing.title,
          },
          metrics: {
            citations: cited.cited_by_count ?? 1,
            amount_hint_usd: input.program.rules.perCitationUsd ?? 0.05,
          },
          confidence,
          proofHash: sensorProofHash(idempotencyKey),
          evidenceRefs: [citedShort, citingShort],
          raw: {
            citedTitle: cited.title,
            citingTitle: citing.title,
            publicationYear: citing.publication_year ?? cited.publication_year,
            observedYear: new Date().getUTCFullYear(),
          },
          missionId: input.program.missionId,
          policyId: input.program.templateId,
        });
      }
    }
  }

  return observations;
}
