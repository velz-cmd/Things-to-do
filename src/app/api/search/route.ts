import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isSearchConfigured,
  listSearchProviders,
  searchDocumentation,
  searchEcosystemProjects,
  searchFundingPages,
  searchGithubIssues,
  searchMaintainers,
  searchPaymentIntegrations,
  searchRepositories,
  unifiedSearch,
} from "@/lib/search";

export const maxDuration = 30;

const bodySchema = z.object({
  query: z.string().min(1),
  intent: z
    .enum([
      "general",
      "github",
      "maintainers",
      "funding",
      "docs",
      "payments",
      "issues",
      "ecosystem",
    ])
    .optional(),
  maxResults: z.number().min(1).max(20).optional(),
});

export async function GET() {
  return NextResponse.json({
    configured: isSearchConfigured(),
    providers: listSearchProviders(),
    fallback: "tavily → serper → websearch",
    cacheTtlSeconds: 300,
    intents: [
      "general",
      "github",
      "maintainers",
      "funding",
      "docs",
      "payments",
      "issues",
      "ecosystem",
    ],
  });
}

export async function POST(req: Request) {
  if (!isSearchConfigured()) {
    return NextResponse.json(
      { error: "No search providers configured (TAVILY, SERPER, or WEBSEARCH API keys)" },
      { status: 503 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const maxResults = body.maxResults ?? 10;
  const intent = body.intent ?? "general";

  try {
    switch (intent) {
      case "github":
        return NextResponse.json(await searchRepositories(body.query, maxResults));
      case "maintainers":
        return NextResponse.json(await searchMaintainers(body.query, maxResults));
      case "funding":
        return NextResponse.json(await searchFundingPages(body.query, maxResults));
      case "docs":
        return NextResponse.json(await searchDocumentation(body.query, maxResults));
      case "payments":
        return NextResponse.json(await searchPaymentIntegrations(body.query, maxResults));
      case "issues":
        return NextResponse.json(await searchGithubIssues(body.query, maxResults));
      case "ecosystem":
        return NextResponse.json(await searchEcosystemProjects(body.query, maxResults));
      default:
        return NextResponse.json(
          await unifiedSearch(body.query, { intent: "general", maxResults }),
        );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed";
    console.error("[search]", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
