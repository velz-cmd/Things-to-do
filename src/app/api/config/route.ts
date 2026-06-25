import { NextResponse } from "next/server";
import { describeSwarmCapabilities, listConfiguredProviders } from "@/lib/ai/gateway";
import { isCardOnRampEnabled, isDeputyDemoMode } from "@/lib/config/demo-mode";
import { listSearchProviders, isSearchConfigured } from "@/lib/search";
import { isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { getArcReadiness } from "@/lib/treasury/arc-readiness";
import { isAlchemyConfigured } from "@/lib/wallet/alchemy";
import { isWalletLabelsConfigured } from "@/lib/wallet/wallet-labels";
import { googleOAuthConfigured } from "@/lib/google/oauth";
import {
  getAgentX402PremiumUrl,
  getDefaultPaidSourcePriceUsd,
  isAgentGatewayEnabled,
} from "@/lib/agent/gateway-config";
import { ARC_MEMO_CONTRACT } from "@/lib/arc/memo-abi";

export async function GET() {
  const ai = listConfiguredProviders();
  const swarm = describeSwarmCapabilities();
  const search = listSearchProviders();
  const hasLlm =
    ai.gemini || ai.groq || ai.openrouter || Boolean(process.env.DASHSCOPE_API_KEY);
  const arcReadiness = await getArcReadiness();

  return NextResponse.json({
    demoMode: isDeputyDemoMode(),
    cardOnRamp: isCardOnRampEnabled(),
    escrowDeployed: Boolean(process.env.NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS),
    resendEnabled: Boolean(process.env.RESEND_API_KEY),
    llmEnabled: hasLlm,
    llmProvider: ai.gemini ? "gemini-primary" : ai.groq ? "groq-primary" : "none",
    ai: { ...ai, swarm },
    search: { ...search, enabled: isSearchConfigured() },
    arcMemos: {
      enabled: isLiveArcEnabled(),
      memoContract: ARC_MEMO_CONTRACT,
      distributionPayouts: arcReadiness.canDistributeOnChain
        ? "onchain_memo"
        : "offchain_only",
      treasuryBalanceUsd: arcReadiness.balanceUsd,
      canDistributeOnChain: arcReadiness.canDistributeOnChain,
      message: arcReadiness.message,
    },
    walletIntelligence: {
      alchemy: isAlchemyConfigured(),
      walletLabels: isWalletLabelsConfigured(),
    },
    integrations: {
      gmail: {
        oauthConfigured: googleOAuthConfigured(),
        authorizePath: "/api/connectors/gmail/authorize",
        setup:
          "Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET on Vercel; redirect URI: {APP_URL}/api/connectors/gmail/callback",
      },
      walletLabels: {
        configured: isWalletLabelsConfigured(),
        setup: "Free API key at https://walletlabels.xyz — set WALLET_LABELS_API_KEY on Vercel",
      },
      cardDeposit: {
        enabled: isCardOnRampEnabled(),
        productionPath: "Use Add funds → Arc tab (USDC on Arc testnet)",
      },
      hackathonMerchants: ["SkyDemo Airlines", "StreamDemo"],
    },
    agentStack: {
      enabled: isAgentGatewayEnabled(),
      x402: true,
      chain: "arcTestnet",
      premiumUrl: getAgentX402PremiumUrl(),
      defaultPriceUsd: getDefaultPaidSourcePriceUsd(),
      flow: "402 → GatewayClient.pay() → mission continues",
      docs: "https://agents.circle.com",
    },
    qwenEnabled: Boolean(process.env.DASHSCOPE_API_KEY),
    geminiEnabled: ai.gemini,
    groqEnabled: ai.groq,
    openrouterEnabled: ai.openrouter,
    cloudflareGateway: ai.cloudflareGateway,
    swarmEnabled: swarm.enabled,
    swarmFlow: swarm.flow,
    liveArc: isLiveArcEnabled(),
    arcTreasury: arcReadiness,
  });
}
