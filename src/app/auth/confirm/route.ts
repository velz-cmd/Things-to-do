import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/** Handles magic-link / token_hash email verification from Supabase emails. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  const next = searchParams.get("next") ?? "/";

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent("Auth not configured")}`
    );
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
