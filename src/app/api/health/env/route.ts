import { NextResponse } from "next/server";
import { getLiveBlockers, isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { getCircleWalletSetId } from "@/lib/wallet/circle-config";
import {
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

/** Safe env presence check — never returns secret values. */
export async function GET() {
  const present = (key: string) => Boolean(process.env[key]?.trim());
  const circleWalletSetId = await getCircleWalletSetId();

  const env = {
    APP_URL: present("APP_URL") || present("NEXT_PUBLIC_APP_URL"),
    PLAYWRIGHT_ENABLED: process.env.PLAYWRIGHT_ENABLED === "true",
    DATABASE_URL: present("DATABASE_URL"),
    SUPABASE_URL: Boolean(getSupabaseServerUrl()),
    NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE: Boolean(getSupabaseServiceRoleKey()),
    RESEND_API_KEY: present("RESEND_API_KEY"),
    EMAIL_LOGIN_CODES: isSupabaseAdminConfigured() && present("RESEND_API_KEY"),
    CIRCLE_API_KEY: present("CIRCLE_API_KEY"),
    CIRCLE_ENTITY_SECRET: present("CIRCLE_ENTITY_SECRET"),
    CIRCLE_WALLET_SET_ID: present("CIRCLE_WALLET_SET_ID"),
    CIRCLE_WALLET_SET_CONFIGURED: Boolean(circleWalletSetId),
    ARC_CLIENT_WALLET_ADDRESS: present("ARC_CLIENT_WALLET_ADDRESS"),
    ARC_PROVIDER_WALLET_ADDRESS: present("ARC_PROVIDER_WALLET_ADDRESS"),
    ARC_RPC_URL: present("ARC_RPC_URL"),
    ARC_PROVIDER_WALLET_ID: present("ARC_PROVIDER_WALLET_ID"),
    ARC_CLIENT_WALLET_ID: present("ARC_CLIENT_WALLET_ID"),
    GEMINI_API_KEY: present("GEMINI_API_KEY") || present("GOOGLE_GENERATIVE_AI_API_KEY"),
    GROQ_API_KEY: present("GROQ_API_KEY"),
    OPENROUTER_API_KEY: present("OPENROUTER_API_KEY"),
    CLOUDFLARE_GATEWAY: present("CLOUDFLARE_ACCOUNT_ID"),
  };

  const missing: string[] = [];
  if (!env.PLAYWRIGHT_ENABLED) missing.push("PLAYWRIGHT_ENABLED=true");
  if (!env.APP_URL) missing.push("APP_URL=https://resolve-task.vercel.app");
  if (!env.CIRCLE_API_KEY) missing.push("CIRCLE_API_KEY");
  if (!env.CIRCLE_ENTITY_SECRET) missing.push("CIRCLE_ENTITY_SECRET");
  if (!env.ARC_CLIENT_WALLET_ADDRESS) missing.push("ARC_CLIENT_WALLET_ADDRESS");
  if (!env.ARC_PROVIDER_WALLET_ADDRESS)
    missing.push("ARC_PROVIDER_WALLET_ADDRESS");

  return NextResponse.json({
    ok: true,
    deploy: "env-diagnostic-v1",
    env,
    arc: {
      liveEnabled: isLiveArcEnabled(),
      blockers: getLiveBlockers(),
    },
    missingRecommended: missing,
  });
}
