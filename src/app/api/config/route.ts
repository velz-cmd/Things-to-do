import { NextResponse } from "next/server";
import { describeSwarmCapabilities, listConfiguredProviders } from "@/lib/ai/gateway";
import { listSearchProviders, isSearchConfigured } from "@/lib/search";
import { isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { isAlchemyConfigured } from "@/lib/wallet/alchemy";
import { isWalletLabelsConfigured } from "@/lib/wallet/wallet-labels";
import { ARC_MEMO_CONTRACT } from "@/lib/arc/memo-abi";

export async function GET() {
  const ai = listConfiguredProviders();
  const swarm = describeSwarmCapabilities();
  const search = listSearchProviders();
  const hasLlm =
    ai.gemini || ai.groq || ai.openrouter || Boolean(process.env.DASHSCOPE_API_KEY);

  return NextResponse.json({
    demoMode: process.env.DEPUTY_DEMO_MODE === "true",
    escrowDeployed: Boolean(process.env.NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS),
    resendEnabled: Boolean(process.env.RESEND_API_KEY),
    llmEnabled: hasLlm,
    llmProvider: ai.gemini ? "gemini-primary" : ai.groq ? "groq-primary" : "none",
    ai: { ...ai, swarm },
    search: { ...search, enabled: isSearchConfigured() },
    arcMemos: {
      enabled: isLiveArcEnabled(),
      memoContract: ARC_MEMO_CONTRACT,
      distributionPayouts: isLiveArcEnabled() ? "onchain_memo" : "offchain_only",
    },
    walletIntelligence: {
      alchemy: isAlchemyConfigured(),
      walletLabels: isWalletLabelsConfigured(),
    },
    qwenEnabled: Boolean(process.env.DASHSCOPE_API_KEY),
    geminiEnabled: ai.gemini,
    groqEnabled: ai.groq,
    openrouterEnabled: ai.openrouter,
    cloudflareGateway: ai.cloudflareGateway,
    swarmEnabled: swarm.enabled,
    swarmFlow: swarm.flow,
    liveArc: isLiveArcEnabled(),
  });
}
