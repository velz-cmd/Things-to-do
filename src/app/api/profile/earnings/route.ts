import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { getProfileEarningsSummary } from "@/lib/earn/summary";
import { sanitizeConnectorIdentities } from "@/lib/identity/sanitize-profile";

/** Profile earnings — ledger-backed "You earned $X" summary. */
export async function GET() {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json({
      ok: true,
      signedIn: false,
      youEarnedUsd: 0,
      claimableUsd: 0,
      authorizedUsd: 0,
      settledUsd: 0,
      pendingUsd: 0,
      authorizationCount: 0,
      identities: [],
      stalestClaimableAt: null,
      notifyUrgency: 0,
      githubLinked: false,
    });
  }

  let profile = await ensureProfileForUser(authUser);
  profile = await sanitizeConnectorIdentities(authUser.id, profile);
  const summary = await getProfileEarningsSummary({ profile });

  return NextResponse.json({
    ok: true,
    signedIn: true,
    ...summary,
  });
}
