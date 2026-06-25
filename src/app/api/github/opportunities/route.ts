import { NextResponse } from "next/server";
import { hasGithubToken } from "@/lib/github/client";
import { scanAllOpportunities } from "@/lib/github/opportunities";

/** Radar feed — unfunded high-value GitHub repositories. */
export async function GET() {
  const opportunities = await scanAllOpportunities();
  return NextResponse.json({
    phase: "github-v1",
    tokenConfigured: hasGithubToken(),
    count: opportunities.length,
    opportunities,
    message: hasGithubToken()
      ? "Live GitHub GraphQL + REST scan"
      : "Set GITHUB_TOKEN for live PR/review ingestion",
  });
}
