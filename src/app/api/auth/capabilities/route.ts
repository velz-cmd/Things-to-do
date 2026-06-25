import { NextResponse } from "next/server";
import {
  getSupabaseServerUrl,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

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
    try {
      const res = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: anonKey, Accept: "application/json" },
        next: { revalidate: 60 },
      });
      if (res.ok) {
        const settings = (await res.json()) as {
          external?: {
            google?: { enabled?: boolean };
            github?: { enabled?: boolean };
          };
        };
        google = Boolean(settings.external?.google?.enabled);
        github = Boolean(settings.external?.github?.enabled);
      }
    } catch {
      google = false;
      github = false;
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
