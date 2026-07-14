import { NextResponse } from "next/server";
import { ensureCircleEntitySecret } from "@/lib/wallet/circle-config";
import { circleErrorMessage } from "@/lib/wallet/circle-errors";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Resolve or generate Circle entity secret; persist to DB when generated. */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.CIRCLE_API_KEY?.trim()) {
    return NextResponse.json(
      { ok: false, error: "CIRCLE_API_KEY is not configured on this deployment." },
      { status: 500 }
    );
  }

  try {
    const result = await ensureCircleEntitySecret();
    return NextResponse.json({
      ok: true,
      generated: result.generated,
      normalizedFromEnv: result.normalizedFromEnv,
      entitySecret: result.generated || result.normalizedFromEnv ? result.entitySecret : undefined,
      hints: [
        result.generated
          ? "New entity secret generated and registered with Circle. Copy entitySecret to Vercel CIRCLE_ENTITY_SECRET now, then redeploy."
          : "Existing entity secret is valid. entitySecret is omitted unless it was just generated or normalized.",
        "Save recovery/recovery_file_*.dat when using scripts/register-circle-entity-secret.ts register.",
        "If registration fails with 'already set' and you lost the hex, use Console Reset + recovery file or a new API key — see docs/CIRCLE-SETUP.md.",
        result.normalizedFromEnv
          ? "Env secret had colons or casing — use 64 lowercase hex chars on Vercel."
          : null,
      ].filter(Boolean),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: circleErrorMessage(err),
        hints: [
          "Lost secret? Cancel Console Rotate; try Reset with recovery_file_*.dat or docs/CIRCLE-SETUP.md.",
        ],
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
