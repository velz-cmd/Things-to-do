import { NextResponse } from "next/server";
import { describeSwarmCapabilities, listConfiguredProviders } from "@/lib/ai/gateway";

export async function GET() {
  const ai = listConfiguredProviders();
  const swarm = describeSwarmCapabilities();
  const hasLlm =
    ai.gemini || ai.groq || ai.openrouter || Boolean(process.env.DASHSCOPE_API_KEY);

  return NextResponse.json({
    demoMode: process.env.DEPUTY_DEMO_MODE === "true",
    escrowDeployed: Boolean(process.env.NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS),
    resendEnabled: Boolean(process.env.RESEND_API_KEY),
    llmEnabled: hasLlm,
    llmProvider: ai.gemini ? "gemini-primary" : ai.groq ? "groq-primary" : "none",
    ai: { ...ai, swarm },
    qwenEnabled: Boolean(process.env.DASHSCOPE_API_KEY),
    geminiEnabled: ai.gemini,
    groqEnabled: ai.groq,
    openrouterEnabled: ai.openrouter,
    cloudflareGateway: ai.cloudflareGateway,
    swarmEnabled: swarm.enabled,
    swarmFlow: swarm.flow,
  });
}
