import { pingBlockscout } from "@/lib/integrations/blockscout";
import { pingLibrariesIo } from "@/lib/integrations/libraries-io";
import { pingOpenAlex } from "@/lib/integrations/openalex";
import { pingNpmRegistry } from "@/lib/integrations/npm-registry";
import { pingDockerHub } from "@/lib/integrations/docker-hub";
import { INTEGRATIONS } from "@/lib/integrations/config";
import { hasGithubToken } from "@/lib/github/client";
import { listConfiguredProviders } from "@/lib/ai/gateway/resolve";
import { isAlchemyConfigured } from "@/lib/wallet/alchemy";

export async function runIntegrationHealthCheck() {
  const ai = listConfiguredProviders();

  const [github, libraries, openAlex, blockscout, npm, docker] = await Promise.all([
    pingGithub(),
    pingLibrariesIo(),
    pingOpenAlex(),
    pingBlockscout(),
    pingNpmRegistry(),
    pingDockerHub(),
  ]);

  const openRouter = ai.openrouter
    ? await pingOpenRouter()
    : { ok: false, message: "OPENROUTER_API_KEY not set" };

  return {
    checkedAt: new Date().toISOString(),
    configured: {
      github: INTEGRATIONS.github(),
      openRouter: INTEGRATIONS.openRouter(),
      groq: INTEGRATIONS.groq(),
      librariesIo: INTEGRATIONS.librariesIo(),
      openAlex: INTEGRATIONS.openAlex(),
      blockscout: INTEGRATIONS.blockscout(),
      npmRegistry: INTEGRATIONS.npmRegistry(),
      dockerHub: INTEGRATIONS.dockerHub(),
      alchemy: isAlchemyConfigured(),
      etherscan: INTEGRATIONS.etherscan(),
    },
    live: {
      github,
      openRouter,
      librariesIo: libraries,
      openAlex,
      blockscout,
      npmRegistry: npm,
      dockerHub: docker,
      alchemy: isAlchemyConfigured()
        ? { ok: true, message: "Alchemy Arc RPC configured" }
        : { ok: false, message: "ALCHEMY_API_KEY not set" },
    },
    models: ai.tiers,
  };
}

async function pingGithub(): Promise<{ ok: boolean; message: string }> {
  if (!hasGithubToken()) {
    return { ok: false, message: "GITHUB_TOKEN not set" };
  }
  try {
    const res = await fetch("https://api.github.com/rate_limit", {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "RESOLVE-Health",
      },
    });
    if (!res.ok) return { ok: false, message: `GitHub HTTP ${res.status}` };
    const json = (await res.json()) as { rate?: { remaining?: number } };
    return {
      ok: true,
      message: `GitHub connected · ${json.rate?.remaining ?? "?"} API calls remaining`,
    };
  } catch {
    return { ok: false, message: "GitHub unreachable" };
  }
}

async function pingOpenRouter(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    });
    if (!res.ok) return { ok: false, message: `OpenRouter HTTP ${res.status}` };
    return { ok: true, message: "OpenRouter connected" };
  } catch {
    return { ok: false, message: "OpenRouter unreachable" };
  }
}
