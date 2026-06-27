import { env, isConfigured } from "@/lib/integrations/config";

export type OpenCollectiveAccount = {
  name: string;
  slug: string;
  description?: string;
  totalReceivedUsd?: number;
  url: string;
};

const ENDPOINT = "https://api.opencollective.com/graphql/v2";

export function isOpenCollectiveConfigured(): boolean {
  return isConfigured("OPENCOLLECTIVE_TOKEN");
}

function authHeaders(): Record<string, string> {
  const token = env("OPENCOLLECTIVE_TOKEN")!;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Personal-Token": token,
    Authorization: `Bearer ${token}`,
  };
}

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T; errors?: unknown[] };
    if (json.errors?.length) return null;
    return json.data ?? null;
  } catch {
    return null;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Search Open Collective for community funding signals. */
export async function searchOpenCollectives(
  term: string,
  limit = 5,
): Promise<OpenCollectiveAccount[]> {
  const searchTerm = term.trim().slice(0, 80);
  if (!searchTerm) return [];

  const data = await graphql<{
    search?: {
      results?: {
        accounts?: {
          collection?: {
            nodes?: Array<{
              name?: string;
              slug?: string;
              description?: string;
            }>;
          };
        };
      };
    };
  }>(
    `query Search($term: String!) {
      search(searchTerm: $term) {
        results {
          accounts {
            collection {
              nodes {
                name
                slug
                description
              }
            }
          }
        }
      }
    }`,
    { term: searchTerm },
  );

  const nodes = data?.search?.results?.accounts?.collection?.nodes ?? [];
  return nodes
    .filter((n) => n.slug && n.name)
    .slice(0, limit)
    .map((n) => ({
      name: n.name!,
      slug: n.slug!,
      description: n.description,
      url: `https://opencollective.com/${n.slug}`,
    }));
}

export async function getOpenCollectiveBySlug(slug: string): Promise<OpenCollectiveAccount | null> {
  const data = await graphql<{
    account?: {
      name?: string;
      slug?: string;
      description?: string;
      stats?: { totalAmountReceived?: { value?: number; currency?: string } };
    };
  }>(
    `query Account($slug: String!) {
      account(slug: $slug) {
        name
        slug
        description
        stats { totalAmountReceived { value currency } }
      }
    }`,
    { slug },
  );

  const a = data?.account;
  if (!a?.slug || !a.name) return null;
  return {
    name: a.name,
    slug: a.slug,
    description: a.description,
    totalReceivedUsd:
      a.stats?.totalAmountReceived?.currency === "USD" ?
        a.stats.totalAmountReceived.value
      : undefined,
    url: `https://opencollective.com/${a.slug}`,
  };
}

export async function findOpenCollectivesForCommunity(
  communityName?: string,
  keywords: string[] = [],
): Promise<OpenCollectiveAccount[]> {
  const terms = [communityName, ...keywords].filter(Boolean) as string[];
  const results: OpenCollectiveAccount[] = [];
  const seen = new Set<string>();

  for (const term of terms.slice(0, 4)) {
    const slug = slugify(term);
    const bySlug = await getOpenCollectiveBySlug(slug);
    if (bySlug && !seen.has(bySlug.slug)) {
      seen.add(bySlug.slug);
      results.push(bySlug);
    }
  }

  if (isOpenCollectiveConfigured()) {
    for (const term of terms.slice(0, 2)) {
      const search = await searchOpenCollectives(term, 3);
      for (const row of search) {
        if (!seen.has(row.slug)) {
          seen.add(row.slug);
          const enriched = (await getOpenCollectiveBySlug(row.slug)) ?? row;
          results.push(enriched);
        }
      }
    }
  }

  return results.slice(0, 5);
}

export async function pingOpenCollective(): Promise<{ ok: boolean; message: string }> {
  if (!isOpenCollectiveConfigured()) {
    return { ok: false, message: "OPENCOLLECTIVE_TOKEN not set" };
  }
  const data = await graphql<{ me?: { id?: string; name?: string } }>(
    `query { me { id name } }`,
  );
  if (data?.me?.id) {
    return { ok: true, message: `Open Collective connected · ${data.me.name ?? "authenticated"}` };
  }
  const sample = await getOpenCollectiveBySlug("babel");
  if (sample) {
    return { ok: true, message: `Open Collective connected · ${sample.name}` };
  }
  return { ok: false, message: "Open Collective auth or query failed" };
}
