import { NextResponse } from "next/server";
import { z } from "zod";
import { API_CACHE, rateLimitHeaders } from "@/lib/api/cache-headers";
import { getRequestClientId, rateLimitRequest } from "@/lib/cache/rate-limit";
import { ingestRepository } from "@/lib/github/adapter";
import { persistGithubEvidence } from "@/lib/github/evidence-store";
import { buildFundingOpportunity } from "@/lib/github/opportunities";
import { persistOssOpportunitySnapshot } from "@/lib/github/oss-scan-store";
import { computeTrustScores } from "@/lib/github/sybil-shield";

const OWNER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;
const REPOSITORY_PATTERN = /^[a-z0-9._-]{1,100}$/;
const normalizedName = z
  .string()
  .transform((value) => value.trim().toLowerCase());

const bodySchema = z
  .object({
    owner: normalizedName
      .pipe(z.string().regex(OWNER_PATTERN))
      .refine((value) => !value.includes("--")),
    repo: normalizedName
      .pipe(z.string().regex(REPOSITORY_PATTERN))
      .refine((value) => value !== "." && value !== ".."),
  })
  .strict();

const ANALYSIS_RATE_LIMIT = 10;
const ANALYSIS_RATE_WINDOW_SECONDS = 60;

function responseHeaders(remaining: number, resetAt: number) {
  return {
    "Cache-Control": API_CACHE.noStore,
    ...rateLimitHeaders(remaining, resetAt),
  };
}

/** Deep GitHub repository analysis with persisted accepted-work evidence. */
export async function POST(req: Request) {
  const rate = await rateLimitRequest(
    `github:analyze:${getRequestClientId(req)}`,
    ANALYSIS_RATE_LIMIT,
    ANALYSIS_RATE_WINDOW_SECONDS,
  );
  const headers = responseHeaders(rate.remaining, rate.resetAt);
  if (!rate.success) {
    return NextResponse.json(
      {
        error: "Too many repository analyses. Try again shortly.",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(
            Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)),
          ),
        },
      },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Enter a valid public GitHub owner and repository.",
        code: "INVALID_REPOSITORY",
      },
      { status: 400, headers },
    );
  }

  let ingest: Awaited<ReturnType<typeof ingestRepository>>;
  try {
    ingest = await ingestRepository(parsed.data.owner, parsed.data.repo);
  } catch {
    return NextResponse.json(
      {
        error: "GitHub repository analysis is temporarily unavailable.",
        code: "GITHUB_UNAVAILABLE",
      },
      { status: 502, headers },
    );
  }
  if (!ingest) {
    return NextResponse.json(
      {
        error: "Public GitHub repository not found.",
        code: "REPOSITORY_NOT_FOUND",
      },
      { status: 404, headers },
    );
  }

  const opportunity = buildFundingOpportunity(ingest);
  const health = opportunity.health;
  const trustScores = Array.from(
    computeTrustScores(ingest.contributors, ingest.pullRequests).values(),
  ).sort((a, b) => b.score - a.score);

  let persisted: Awaited<ReturnType<typeof persistOssOpportunitySnapshot>>;
  try {
    persisted = await persistOssOpportunitySnapshot(opportunity);
    await persistGithubEvidence({
      opportunity,
      fingerprint: persisted.fingerprint,
      observedAt: persisted.observedAt,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Repository analysis could not be saved. Try again shortly.",
        code: "PERSISTENCE_UNAVAILABLE",
        persisted: false,
      },
      { status: 503, headers },
    );
  }

  return NextResponse.json(
    {
      persisted: true,
      fingerprint: persisted.fingerprint,
      observedAt: persisted.observedAt,
      ingest: {
        fullName: ingest.fullName,
        stars: ingest.stars,
        forks: ingest.forks,
        prCount: ingest.pullRequests.length,
        contributorCount: ingest.contributors.length,
        ingestedAt: ingest.ingestedAt,
      },
      health,
      trustScores: trustScores.slice(0, 10),
      pullRequests: ingest.pullRequests.slice(0, 10).map((p) => ({
        number: p.number,
        title: p.title,
        author: p.author,
        additions: p.additions,
        deletions: p.deletions,
        reviewComments: p.reviewComments,
        mergedAt: p.mergedAt,
      })),
    },
    { headers },
  );
}
