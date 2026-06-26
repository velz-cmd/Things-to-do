import { fetchPackageDependentsForRepo, fetchGithubProject } from "@/lib/integrations/libraries-io";
import { fetchRepoNpmUsage } from "@/lib/integrations/npm-registry";
import { fetchDockerUsageForGithubRepo } from "@/lib/integrations/docker-hub";
import { fetchRepoResearchSignal } from "@/lib/integrations/openalex";

export type UpstreamUsageSignal = {
  owner: string;
  repo: string;
  librariesIo?: {
    rank?: number;
    dependents?: number;
    package?: string;
  };
  npm?: {
    packageName: string;
    downloadsLastMonth: number;
    downloadsLastWeek: number;
  };
  docker?: {
    image: string;
    pullCount: number;
    starCount: number;
  };
  openAlex?: {
    works: number;
    citations: number;
  };
  usageScore: number;
  summary: string[];
};

/** Pattern B upstream signals — who benefits when this repo is used downstream. */
export async function collectUpstreamUsageSignals(
  owner: string,
  repo: string,
): Promise<UpstreamUsageSignal> {
  const [lib, pkg, npm, docker, research] = await Promise.all([
    fetchGithubProject(owner, repo),
    fetchPackageDependentsForRepo(owner, repo),
    fetchRepoNpmUsage(owner, repo),
    fetchDockerUsageForGithubRepo(owner, repo),
    fetchRepoResearchSignal(owner, repo),
  ]);

  const summary: string[] = [];
  let usageScore = 0;

  if (pkg?.dependents) {
    summary.push(`${pkg.platform}/${pkg.name}: ${pkg.dependents.toLocaleString()} dependents`);
    usageScore += Math.min(40, Math.log10(pkg.dependents + 1) * 10);
  }
  if (npm?.downloadsLastMonth) {
    summary.push(`npm/${npm.packageName}: ${npm.downloadsLastMonth.toLocaleString()} downloads/mo`);
    usageScore += Math.min(30, Math.log10(npm.downloadsLastMonth + 1) * 8);
  }
  if (docker?.pullCount) {
    summary.push(`docker/${docker.namespace}/${docker.repository}: ${docker.pullCount.toLocaleString()} pulls`);
    usageScore += Math.min(25, Math.log10(docker.pullCount + 1) * 7);
  }
  if (research?.isResearchRepo && research.totalCitations) {
    summary.push(`OpenAlex: ${research.totalCitations.toLocaleString()} citations`);
    usageScore += Math.min(15, Math.log10(research.totalCitations + 1) * 5);
  }
  if (lib?.rank) {
    summary.push(`Libraries.io rank #${lib.rank}`);
  }

  return {
    owner,
    repo,
    librariesIo: {
      rank: lib?.rank,
      dependents: pkg?.dependents,
      package: pkg ? `${pkg.platform}/${pkg.name}` : undefined,
    },
    npm: npm ?? undefined,
    docker: docker
      ? {
          image: `${docker.namespace}/${docker.repository}`,
          pullCount: docker.pullCount,
          starCount: docker.starCount,
        }
      : undefined,
    openAlex: research?.isResearchRepo
      ? { works: research.workCount, citations: research.totalCitations }
      : undefined,
    usageScore: Math.round(usageScore * 10) / 10,
    summary,
  };
}
