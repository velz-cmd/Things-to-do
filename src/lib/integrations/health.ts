import { pingBlockscout } from "@/lib/integrations/blockscout";
import { pingLibrariesIo } from "@/lib/integrations/libraries-io";
import { pingOpenAlex } from "@/lib/integrations/openalex";
import { pingNpmRegistry } from "@/lib/integrations/npm-registry";
import { pingDockerHub } from "@/lib/integrations/docker-hub";
import { pingNavidrome, isNavidromeConfigured } from "@/lib/integrations/navidrome";
import { pingListenBrainz, isListenBrainzConfigured } from "@/lib/integrations/listenbrainz";
import { pingLastFm, isLastFmConfigured } from "@/lib/integrations/lastfm";
import { pingOpenCollective, isOpenCollectiveConfigured } from "@/lib/integrations/opencollective";
import { pingCrossref } from "@/lib/integrations/crossref";
import { pingArxiv } from "@/lib/integrations/arxiv";
import { pingOverpass } from "@/lib/integrations/overpass";
import { pingDiscord, isDiscordConfigured } from "@/lib/integrations/discord";
import { pingMastodon, isMastodonConfigured } from "@/lib/integrations/mastodon";
import { INTEGRATIONS } from "@/lib/integrations/config";
import { hasGithubToken } from "@/lib/github/client";
import { listConfiguredProviders } from "@/lib/ai/gateway/resolve";
import { isAlchemyConfigured } from "@/lib/wallet/alchemy";
import { isSearchConfigured, listSearchProviders } from "@/lib/search";
import { isGeminiConfigured, isGroqConfigured } from "@/lib/ai/gateway/config";
import { googleOAuthConfigured } from "@/lib/google/oauth";
import { refreshGmailAccessToken } from "@/lib/google/gmail-token";

export async function runIntegrationHealthCheck() {
  const ai = listConfiguredProviders();
  const search = listSearchProviders();

  const [
    github,
    libraries,
    openAlex,
    blockscout,
    npm,
    docker,
    navidrome,
    listenbrainz,
    lastfm,
    openCollective,
    crossref,
    arxiv,
    overpass,
    discord,
    mastodon,
    groq,
    gemini,
    gmail,
    tavily,
    serper,
  ] = await Promise.all([
    pingGithub(),
    pingLibrariesIo(),
    pingOpenAlex(),
    pingBlockscout(),
    pingNpmRegistry(),
    pingDockerHub(),
    pingNavidrome(),
    pingListenBrainz(),
    pingLastFm(),
    pingOpenCollective(),
    pingCrossref(),
    pingArxiv(),
    pingOverpass(),
    pingDiscord(),
    pingMastodon(),
    pingGroq(),
    pingGemini(),
    pingGmail(),
    pingTavily(),
    pingSerper(),
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
      gemini: isGeminiConfigured(),
      search: isSearchConfigured(),
      tavily: search.tavily,
      serper: search.serper,
      websearch: search.websearch,
      gmail: googleOAuthConfigured(),
      gmailRefreshToken: Boolean(process.env.GOOGLE_REFRESH_TOKEN?.trim()),
      librariesIo: INTEGRATIONS.librariesIo(),
      openAlex: INTEGRATIONS.openAlex(),
      blockscout: INTEGRATIONS.blockscout(),
      npmRegistry: INTEGRATIONS.npmRegistry(),
      dockerHub: INTEGRATIONS.dockerHub(),
      alchemy: isAlchemyConfigured(),
      etherscan: INTEGRATIONS.etherscan(),
      navidrome: isNavidromeConfigured(),
      listenBrainz: isListenBrainzConfigured(),
      lastFm: isLastFmConfigured(),
      openCollective: isOpenCollectiveConfigured(),
      discord: isDiscordConfigured(),
      mastodon: isMastodonConfigured(),
      crossref: true,
      arxiv: true,
      overpass: true,
    },
    live: {
      github,
      openRouter,
      groq,
      gemini,
      gmail,
      tavily,
      serper,
      librariesIo: libraries,
      openAlex,
      blockscout,
      npmRegistry: npm,
      dockerHub: docker,
      navidrome,
      listenBrainz: listenbrainz,
      lastFm: lastfm,
      openCollective,
      crossref,
      arxiv,
      overpass,
      discord,
      mastodon,
      alchemy: isAlchemyConfigured()
        ? { ok: true, message: "Alchemy Arc RPC configured" }
        : { ok: false, message: "ALCHEMY_API_KEY not set" },
    },
    models: ai.tiers,
    search,
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

async function pingGroq(): Promise<{ ok: boolean; message: string }> {
  if (!isGroqConfigured()) {
    return { ok: false, message: "GROQ_API_KEY not set" };
  }
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    });
    if (!res.ok) return { ok: false, message: `Groq HTTP ${res.status}` };
    return { ok: true, message: "Groq connected" };
  } catch {
    return { ok: false, message: "Groq unreachable" };
  }
}

async function pingGemini(): Promise<{ ok: boolean; message: string }> {
  if (!isGeminiConfigured()) {
    return { ok: false, message: "GEMINI_API_KEY not set" };
  }
  const key =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
    );
    if (!res.ok) return { ok: false, message: `Gemini HTTP ${res.status}` };
    return { ok: true, message: "Gemini connected" };
  } catch {
    return { ok: false, message: "Gemini unreachable" };
  }
}

async function pingGmail(): Promise<{ ok: boolean; message: string }> {
  if (!googleOAuthConfigured()) {
    return { ok: false, message: "GOOGLE_CLIENT_ID/SECRET not set" };
  }
  const refresh = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!refresh) {
    return {
      ok: true,
      message: "Per-user Gmail — connect at Profile (no server GOOGLE_REFRESH_TOKEN required)",
    };
  }
  try {
    await refreshGmailAccessToken(refresh);
    return { ok: true, message: "Server Gmail refresh token valid" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gmail token refresh failed";
    if (msg.includes("invalid_grant")) {
      return {
        ok: false,
        message:
          "invalid_grant — remove GOOGLE_REFRESH_TOKEN from Vercel (wrong OAuth client). Sign in → Profile → Connect Gmail. Setup: GET /api/connectors/gmail/setup",
      };
    }
    return { ok: false, message: msg };
  }
}

async function pingTavily(): Promise<{ ok: boolean; message: string }> {
  if (!process.env.TAVILY_API_KEY?.trim()) {
    return { ok: false, message: "TAVILY_API_KEY not set" };
  }
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: "open source funding",
        max_results: 1,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: false, message: `Tavily HTTP ${res.status}` };
    return { ok: true, message: "Tavily search connected" };
  } catch {
    return { ok: false, message: "Tavily unreachable" };
  }
}

async function pingSerper(): Promise<{ ok: boolean; message: string }> {
  if (!process.env.SERPER_API_KEY?.trim()) {
    return { ok: false, message: "SERPER_API_KEY not set" };
  }
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.SERPER_API_KEY!,
      },
      body: JSON.stringify({ q: "open source", num: 1 }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: false, message: `Serper HTTP ${res.status}` };
    return { ok: true, message: "Serper search connected" };
  } catch {
    return { ok: false, message: "Serper unreachable" };
  }
}
