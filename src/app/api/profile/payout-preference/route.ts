import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import {
  extractGithubIdentity,
  getContributorPayoutPreference,
  setContributorPayoutPreference,
} from "@/lib/identity/contributors";
import { PAYOUT_CURRENCIES, normalizePayoutCurrency } from "@/lib/settlement/fx";

const bodySchema = z.object({
  currency: z.string(),
});

export async function GET() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const profile = await ensureProfileForUser(session.user);
  const { login } = extractGithubIdentity(session.user);
  const githubUsername = login ?? profile.githubUsername;
  if (!githubUsername) {
    return NextResponse.json({ error: "GitHub identity required" }, { status: 403 });
  }

  const currency = await getContributorPayoutPreference(githubUsername);
  return NextResponse.json({
    githubUsername,
    currency,
    options: PAYOUT_CURRENCIES,
  });
}

export async function POST(req: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "currency required" }, { status: 400 });
  }

  const profile = await ensureProfileForUser(session.user);
  const { login } = extractGithubIdentity(session.user);
  const githubUsername = login ?? profile.githubUsername;
  if (!githubUsername) {
    return NextResponse.json({ error: "GitHub identity required" }, { status: 403 });
  }

  const currency = normalizePayoutCurrency(parsed.data.currency);
  await setContributorPayoutPreference(githubUsername, currency);

  return NextResponse.json({ ok: true, currency, options: PAYOUT_CURRENCIES });
}
