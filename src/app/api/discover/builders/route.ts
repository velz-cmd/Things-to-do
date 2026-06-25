import { NextResponse } from "next/server";
import { listHiddenBuilders } from "@/lib/weight/discovery";
import { runLiveDiscoveryScan, scanGithubRepo } from "@/lib/discovery/github-scan";

/**
 * Unpaid Value Index — merges live GitHub scans with curated signals.
 * Differentiator: real discovery data, not a static payee registry.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") ?? undefined;
  const minScore = searchParams.get("minScore");
  const liveOnly = searchParams.get("live") === "true";

  const repo = searchParams.get("repo");
  if (repo?.includes("/")) {
    const [owner, name] = repo.split("/");
    const scanned = await scanGithubRepo(owner, name);
    return NextResponse.json({
      repo: owner + "/" + name,
      discovered: scanned.builders.length,
      builders: scanned.builders,
      meta: scanned.repo,
    });
  }

  const [curated, live] = await Promise.all([
    Promise.resolve(listHiddenBuilders({ platform, minScore: minScore ? Number(minScore) : undefined })),
    runLiveDiscoveryScan(),
  ]);

  const merged = liveOnly
    ? live
    : [...live, ...curated.filter((c) => !live.some((l) => l.name.toLowerCase() === c.name.toLowerCase()))];

  merged.sort((a, b) => b.impactScore - a.impactScore);

  return NextResponse.json({
    index: "unpaid-value",
    discovered: merged.length,
    liveScanned: live.length,
    builders: merged.slice(0, 20),
    updatedAt: new Date().toISOString(),
    thesis: "Find who should be paid — before anyone uploads a CSV or builds another registry",
    scanRepos: "GET ?repo=navidrome/navidrome",
  });
}
