import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function POST() {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const hasServerGmail = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GOOGLE_CLIENT_SECRET
  );

  if (!hasServerGmail) {
    return NextResponse.json({
      ok: false,
      state: "needs_auth",
      message:
        "Gmail OAuth is not configured on this deployment. Use demo receipt upload or contact support.",
    });
  }

  await prisma.user.update({
    where: { id: ready.user.id },
    data: { gmailConnected: true },
  });

  return NextResponse.json({
    ok: true,
    state: "connected",
    message: "Gmail connector enabled for this account",
  });
}
