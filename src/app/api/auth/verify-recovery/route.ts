import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Server-side recovery verify — sets session cookies reliably after user confirms. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tokenHash = String((body as { token_hash?: string }).token_hash ?? "").trim();
  const type = String((body as { type?: string }).type ?? "recovery") as EmailOtpType;

  if (!tokenHash) {
    return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 503 });
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    const lower = error.message.toLowerCase();
    const friendly =
      lower.includes("invalid") || lower.includes("expired")
        ? "This reset link expired or was already used. Request a new one and open only the latest email."
        : error.message;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    return NextResponse.json(
      { error: "Could not start a reset session. Request a new link." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
