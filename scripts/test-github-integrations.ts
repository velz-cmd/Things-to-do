/**
 * Live integration test — hits real APIs. Requires keys in environment.
 * Usage: set -a && source .env.local && set +a && tsx scripts/test-github-integrations.ts
 */
import { runIntegrationHealthCheck } from "../src/lib/integrations/health";
import { fetchGithubProject } from "../src/lib/integrations/libraries-io";
import { fetchRepoResearchSignal } from "../src/lib/integrations/openalex";
import { ingestRepository } from "../src/lib/github/adapter";
import { runGithubPipeline } from "../src/lib/github/pipeline";
import { generateObjectWithFallback } from "../src/lib/ai/gateway/resolve";
import { z } from "zod";

async function main() {
  console.log("=== RESOLVE Integration Health ===\n");
  const health = await runIntegrationHealthCheck();
  console.log(JSON.stringify(health, null, 2));

  console.log("\n=== Libraries.io navidrome/navidrome ===");
  const lib = await fetchGithubProject("navidrome", "navidrome");
  console.log(lib ? `dependents: ${lib.dependents_count ?? lib.dependent_repos_count}` : "failed");

  console.log("\n=== OpenAlex research signal ===");
  const oa = await fetchRepoResearchSignal("langchain-ai", "langchain");
  console.log(oa ?? "no signal");

  if (process.env.GITHUB_TOKEN) {
    console.log("\n=== GitHub ingest navidrome/navidrome ===");
    const ingest = await ingestRepository("navidrome", "navidrome", { prLimit: 3 });
    console.log(
      ingest
        ? `PRs: ${ingest.pullRequests.length} · stars: ${ingest.stars} · contributors: ${ingest.contributors.length}`
        : "ingest failed",
    );

    console.log("\n=== Full pipeline (small pool) ===");
    const pipeline = await runGithubPipeline({
      owner: "navidrome",
      repo: "navidrome",
      fundPoolUsd: 1000,
      evaluationDays: 90,
      useLlm: Boolean(process.env.OPENROUTER_API_KEY),
    });
    if ("error" in pipeline) {
      console.log("pipeline error:", pipeline.error);
    } else {
      console.log(
        `contributors: ${pipeline.allocation.contributors.length} · evidence: ${pipeline.busEvidenceCount} · proof: ${pipeline.proof.proofRoot.slice(0, 18)}…`,
      );
    }
  } else {
    console.log("\n(skip GitHub ingest — GITHUB_TOKEN not set locally)");
  }

  if (process.env.OPENROUTER_API_KEY) {
    console.log("\n=== OpenRouter code tier ===");
    try {
      const { object, meta } = await generateObjectWithFallback({
        tier: "code",
        schema: z.object({ ok: z.boolean() }),
        prompt: 'Reply {"ok": true}',
        system: "Return JSON only",
      });
      console.log("code model:", meta.modelId, object);
    } catch (e) {
      console.log("code tier error:", e instanceof Error ? e.message : e);
    }
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
