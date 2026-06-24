import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    demoMode: process.env.DEPUTY_DEMO_MODE === "true",
    escrowDeployed: Boolean(process.env.NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS),
    resendEnabled: Boolean(process.env.RESEND_API_KEY),
    qwenEnabled: Boolean(process.env.DASHSCOPE_API_KEY),
    geminiEnabled: Boolean(
      process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    ),
    llmProvider: process.env.DASHSCOPE_API_KEY
      ? "qwen"
      : process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
        ? "gemini"
        : "none",
  });
}
