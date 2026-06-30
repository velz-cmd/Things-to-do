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
  getAgentSentimentUrl,
  getAgentX402PremiumUrl,
  getDefaultPaidSourcePriceUsd,
  getSentimentPriceUsd,
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
        refreshTokenConfigured: Boolean(process.env.GOOGLE_REFRESH_TOKEN?.trim()),
        authorizePath: "/api/connectors/gmail/authorize",
        healthPath: "/api/integrations/health",
        setup:
          "Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN on Vercel; redirect URI: {APP_URL}/api/connectors/gmail/callback",
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
      sentimentUrl: getAgentSentimentUrl(),
      defaultPriceUsd: getDefaultPaidSourcePriceUsd(),
      sentimentPriceUsd: getSentimentPriceUsd(),
      serviceCatalog: "/api/agent/services",
      invoke: "/api/agent/invoke",
      flow: "discover → 402 → GatewayClient.pay() → ledger mcp.invocation → agent continues",
      docs: "https://agents.circle.com",
    },
    impactWeight: {
      enabled: true,
      phase: "github-v1",
      signals: 7,
      flow: "Radar → Sybil Shield → Weight Council → Founder Intent → Arc",
      methodology: "/methodology",
      radar: "/radar",
      discovery: "/discover",
      protocol: "/protocol",
      evaluateEndpoint: "/api/weight/evaluate",
      githubAllocate: "/api/github/allocate",
      githubOpportunities: "/api/github/opportunities",
      githubBlueprint: "/api/github/blueprint",
      githubOsDocs: "/docs/GITHUB-OS.md",
    },
    paymentLayer: {
      enabled: true,
      philosophy: "Stripe moves money — never decides who deserves payment",
      settlePage: "/settle",
      blueprint: "/api/payment/blueprint",
      docs: "/docs/PAYMENT-LAYER.md",
      endpoints: {
        createSettlement: "/api/payment/create-settlement",
        lockEscrow: "/api/payment/lock-escrow",
        executeBatch: "/api/payment/execute-batch",
        fromAllocation: "/api/payment/from-allocation",
        fromGithub: "/api/payment/from-github",
        history: "/api/payment/history",
        retry: "/api/payment/retry",
      },
    },
    protocol: {
      name: "RESOLVE Open Impact Settlement Protocol",
      version: "0.1.0",
      openSource: "https://github.com/velz-cmd/Things-to-do",
      spec: "/api/protocol",
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
