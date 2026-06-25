import { NextResponse } from "next/server";
import { GITHUB_OS_BLUEPRINT } from "@/lib/github/blueprint";
import { INTEGRATIONS } from "@/lib/integrations/config";
import { listConfiguredProviders } from "@/lib/ai/gateway/resolve";

/** Machine-readable RESOLVE GitHub OS blueprint. */
export async function GET() {
  const ai = listConfiguredProviders();
  return NextResponse.json({
    ...GITHUB_OS_BLUEPRINT,
    runtime: {
      githubToken: INTEGRATIONS.github(),
      openRouter: ai.openrouter,
      groq: ai.groq,
      gemini: ai.gemini,
      librariesIo: INTEGRATIONS.librariesIo(),
      blockscout: INTEGRATIONS.blockscout(),
      openAlex: INTEGRATIONS.openAlex(),
      alchemy: INTEGRATIONS.alchemy(),
      etherscan: INTEGRATIONS.etherscan(),
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
