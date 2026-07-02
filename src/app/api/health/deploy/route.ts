import { NextResponse } from "next/server";
import { cronSecretHasWhitespace, claimTokenSecretHasWhitespace } from "@/lib/env/cron-secret";

export const runtime = "edge";

/** Production deploy fingerprint — verify main is live on Vercel. */
export async function GET() {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.VERCEL_GIT_COMMIT_REF ??
    "local";

  return NextResponse.json({
    ok: true,
    commit,
    ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.slice(0, 120) ?? null,
    deployedAt: process.env.VERCEL_DEPLOYMENT_ID ? new Date().toISOString() : null,
    vercelEnv: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    phases: {
      phase0: true,
      phase1: true,
      phase2: true,
      phase3: true,
      phase4: true,
      phase5: true,
      phase6: true,
      phase7: true,
      phase8: true,
      phase9: true,
    },
    warnings: [
      ...(cronSecretHasWhitespace()
        ? [
            "CRON_SECRET has leading/trailing whitespace in Vercel — runtime uses trimmed value; trim in dashboard to clear this warning",
          ]
        : []),
      ...(claimTokenSecretHasWhitespace()
        ? ["CLAIM_TOKEN_SECRET has leading/trailing whitespace — trim in Vercel"]
        : []),
    ],
  });
}
