import { NextResponse } from "next/server";
import { runIntegrationHealthCheck } from "@/lib/integrations/health";
import { getArcReadiness } from "@/lib/treasury/arc-readiness";
import { prisma } from "@/lib/db";
import {
  fetchSupabaseAuthSettings,
  isSupabaseExternalProviderEnabled,
} from "@/lib/supabase/auth-settings";

/** Honest production status — what is real vs not configured */
export async function GET() {
  const [integrations, arc, settlementCount, pendingRewardCount, authorizationCount] =
    await Promise.all([
    runIntegrationHealthCheck(),
    getArcReadiness(),
    prisma.missionSettlement.count().catch(() => -1),
    prisma.pendingReward.count().catch(() => -1),
    prisma.paymentAuthorization.count().catch(() => -1),
  ]);

  let githubOAuth = false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    const settings = await fetchSupabaseAuthSettings(url, anon);
    githubOAuth = isSupabaseExternalProviderEnabled(settings?.external?.github);
  }

  const issues: string[] = [];
  if (!arc.canDistributeOnChain) issues.push(arc.message);
  if (!githubOAuth) {
    issues.push("GitHub OAuth not enabled in Supabase — /claim sign-in will not work until enabled");
  }
  if (settlementCount === -1) issues.push("Payment tables unreachable — check DATABASE_URL");
  if (pendingRewardCount === -1) issues.push("PendingReward table missing");
  if (authorizationCount === -1) issues.push("PaymentAuthorization table missing — run SUPABASE-AUTHORIZATION-LEDGER.sql");

  return NextResponse.json({
    ok: issues.length === 0,
    liveAt: "https://resolve-task.vercel.app",
    real: {
      githubPipeline: integrations.live.github?.ok ?? false,
      arcOnChainPayouts: arc.canDistributeOnChain,
      treasuryUsd: arc.balanceUsd,
      database: settlementCount >= 0,
      paymentTables: settlementCount >= 0,
      settlementsRecorded: settlementCount,
      pendingRewards: pendingRewardCount >= 0 ? pendingRewardCount : 0,
      authorizations: authorizationCount >= 0 ? authorizationCount : 0,
      authorizationLedger: authorizationCount >= 0,
    },
    needsSetup: {
      githubOAuth: !githubOAuth,
      googleOAuth: false,
    },
    cosmetic: {
      escrowLockRef:
        "Mission escrow lock is a ledger record (escrow:...) until ERC-8183 vault is wired",
      homepageDemoMission: "Example mission on homepage is labeled Demo when no live task",
    },
    issues,
    integrations: integrations.live,
    arc,
  });
}
