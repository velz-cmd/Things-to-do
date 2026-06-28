import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { getBankingAccountSnapshot } from "@/lib/banking/account";

/** RESOLVE Banking — unified account snapshot (custody, no interest). */
export async function GET() {
  try {
    const authUser = await getSessionUser();
    const profile = authUser ? await ensureProfileForUser(authUser) : null;
    const snapshot = await getBankingAccountSnapshot({ authUser, profile });
    return NextResponse.json(snapshot);
  } catch (e) {
    console.error("[banking/account]", e);
    const snapshot = await getBankingAccountSnapshot({ authUser: null, profile: null });
    return NextResponse.json(snapshot);
  }
}
