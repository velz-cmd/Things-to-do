import { NextResponse } from "next/server";
import { getWalletBalance, getSessionUserId } from "@/lib/wallet/service";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({
      availableUsd: 0,
      lockedUsd: 0,
      releasedUsd: 0,
      recentActivity: [],
      authenticated: false,
    });
  }

  const balance = await getWalletBalance(userId);
  return NextResponse.json({ ...balance, authenticated: true });
}
