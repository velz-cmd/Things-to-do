import { NextResponse } from "next/server";
import {
  findValidResetToken,
  maskEmail,
} from "@/lib/auth/password-reset-token";

export const runtime = "nodejs";

/** Check reset token without consuming it (prefetch-safe). */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
  }

  const row = await findValidResetToken(token);
  if (!row) {
    return NextResponse.json(
      {
        error:
          "This reset link expired or was already used. Request a new one and open only the latest email.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    email: maskEmail(row.email),
  });
}
