import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import {
  findValidResetToken,
  markResetTokenUsed,
} from "@/lib/auth/password-reset-token";
import { sanitizeAuthApiError } from "@/lib/auth/sanitize-auth-error";
import { ensureProfileForUser } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Validate app token, set password via Supabase admin, sign in, persist profile + wallet.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String((body as { token?: string }).token ?? "").trim();
  const password = String((body as { password?: string }).password ?? "");

  if (!token) {
    return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
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

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Password reset is not configured on the server." },
      { status: 503 },
    );
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(row.userId, {
    password,
    email_confirm: true,
  });

  if (updateError) {
    return NextResponse.json(
      {
        error: sanitizeAuthApiError(
          updateError,
          "Could not save password. Try again.",
        ),
      },
      { status: 400 },
    );
  }

  await markResetTokenUsed(row.id);

  const response = NextResponse.json({ ok: true });
  const supabase = await createRouteHandlerClient(response);
  if (!supabase) {
    return NextResponse.json(
      { error: "Auth is not configured." },
      { status: 503 },
    );
  }

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: row.email,
      password,
    });

  if (signInError || !signInData.user) {
    return NextResponse.json(
      {
        error:
          "Password saved but sign-in failed. Try signing in with your new password.",
      },
      { status: 400 },
    );
  }

  try {
    await ensureProfileForUser(signInData.user);
  } catch {
    /* provisioned on next API call */
  }

  return response;
}
