import { NextResponse } from "next/server";
import { GITHUB_OS_BLUEPRINT } from "@/lib/github/blueprint";
import { hasGithubToken } from "@/lib/github/client";
import { listConfiguredProviders } from "@/lib/ai/gateway/resolve";

/** Machine-readable RESOLVE GitHub OS blueprint. */
export async function GET() {
  const ai = listConfiguredProviders();
  return NextResponse.json({
    ...GITHUB_OS_BLUEPRINT,
    runtime: {
      githubToken: hasGithubToken(),
      openRouter: ai.openrouter,
      groq: ai.groq,
      gemini: ai.gemini,
      librariesIo: Boolean(process.env.LIBRARIES_IO_API_KEY),
      blockscout: Boolean(process.env.BLOCKSCOUT_API_URL ?? "https://testnet.arcscan.app/api"),
      openAlex: Boolean(process.env.OPENALEX_API_KEY),
    },
    endpoints: {
      opportunities: "GET /api/github/opportunities",
      analyze: "POST /api/github/analyze",
      allocate: "POST /api/github/allocate",
      blueprint: "GET /api/github/blueprint",
      proof: "GET /api/github/proof?txHash=0x...",
    },
    docs: "/docs/GITHUB-OS.md",
    ui: "/blueprint",
  });
}
