import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestRepository } from "@/lib/github/adapter";
import { computeRepoHealth } from "@/lib/github/repo-health";
import { computeTrustScores } from "@/lib/github/sybil-shield";

const bodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

/** Deep GitHub repo analysis — ingest + health + trust scores. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
  }

  const ingest = await ingestRepository(parsed.data.owner, parsed.data.repo);
  if (!ingest) {
    return NextResponse.json({ error: "Repository not found or API limit" }, { status: 404 });
  }

  const health = computeRepoHealth(ingest);
  const trustScores = Array.from(
    computeTrustScores(ingest.contributors, ingest.pullRequests).values(),
  ).sort((a, b) => b.score - a.score);

  return NextResponse.json({
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
  });
}
