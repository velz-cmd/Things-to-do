import { NextResponse } from "next/server";
import { bootstrapProductionSensors } from "@/lib/sensors/bootstrap";
import { hasGithubToken } from "@/lib/github/client";
import { INTEGRATIONS } from "@/lib/integrations/config";

function authorize(req: Request): boolean {
  const cron = process.env.CRON_SECRET?.trim();
  const bootstrap = process.env.BOOTSTRAP_SENSOR_SECRET?.trim();
  const auth = req.headers.get("authorization");

  if (cron && auth === `Bearer ${cron}`) return true;
  if (bootstrap && auth === `Bearer ${bootstrap}`) return true;
  if (!cron && !bootstrap) return true;
  return false;
}

/** One-shot production bootstrap: install communities → programs → sensor sync → ledger rows. */
export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasGithubToken()) {
    return NextResponse.json(
      { ok: false, error: "GITHUB_TOKEN not configured on server" },
      { status: 503 },
    );
  }

  if (!INTEGRATIONS.openAlex()) {
    return NextResponse.json(
      { ok: false, error: "OPENALEX_API_KEY not configured on server" },
      { status: 503 },
    );
  }

  let userId: string | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as { userId?: string };
    userId = body.userId;
  } catch {
    userId = undefined;
  }

  const result = await bootstrapProductionSensors({ userId });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/cron/bootstrap-sensors",
    githubToken: hasGithubToken(),
    openAlex: INTEGRATIONS.openAlex(),
    hint: "Installs react/linux/open-research, creates RFB programs, runs sensor sync",
  });
}
