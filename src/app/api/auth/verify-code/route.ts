import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String((body as { email?: string }).email ?? "")
    .trim()
    .toLowerCase();
  const token = String((body as { code?: string }).code ?? "")
    .replace(/\s/g, "");

  if (!email || !token || token.length < 6) {
    return NextResponse.json({ error: "Email and 6-digit code required" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return NextResponse.json(
      { error: "Invalid or expired code. Request a new one." },
      { status: 400 }
    );
  }

  if (!data.session || !data.user) {
    return NextResponse.json({ error: "Could not create session" }, { status: 500 });
  }

  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  const isNew =
    data.user.created_at &&
    Date.now() - new Date(data.user.created_at).getTime() < 120_000;

  try {
    await ensureProfileForUser(data.user);
  } catch {
    /* profile provisioning is best-effort */
  }

  return NextResponse.json({
    ok: true,
    isNewUser: isNew,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });
}
