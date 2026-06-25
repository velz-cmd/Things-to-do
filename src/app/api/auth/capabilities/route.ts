import { NextResponse } from "next/server";
import {
  getSupabaseServerUrl,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import {
  fetchSupabaseAuthSettings,
  isSupabaseExternalProviderEnabled,
} from "@/lib/supabase/auth-settings";

function getAnonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

/** Runtime auth capability probe — never trust build-time NEXT_PUBLIC_* alone. */
export async function GET() {
  const url = getSupabaseServerUrl();
  const anonKey = getAnonKey();
  const supabase = Boolean(url && anonKey);

  let google = false;
  let github = false;
  if (supabase) {
    const settings = await fetchSupabaseAuthSettings(url, anonKey);
    if (settings?.external) {
      google = isSupabaseExternalProviderEnabled(settings.external.google);
      github = isSupabaseExternalProviderEnabled(settings.external.github);
    }
  }

  const emailOtp = isSupabaseAdminConfigured();
  const emailMagicLink = supabase;
  const email = Boolean(supabase && isSupabaseAdminConfigured());

  const wallet = true;

  return NextResponse.json({
    supabase,
    email,
    emailMagicLink,
    emailOtp,
    google: supabase && google,
    github: supabase && github,
    wallet,
    guest: true,
    publicConfig: supabase ? { url, anonKey } : null,
  });
}
