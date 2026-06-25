/** Supabase may return `external.github: true` or `{ enabled: true }`. */
export function isSupabaseExternalProviderEnabled(
  provider: boolean | { enabled?: boolean } | undefined
): boolean {
  if (typeof provider === "boolean") return provider;
  return Boolean(provider?.enabled);
}

export type SupabaseAuthSettings = {
  external?: Record<string, boolean | { enabled?: boolean } | undefined>;
};

export async function fetchSupabaseAuthSettings(
  url: string,
  anonKey: string
): Promise<SupabaseAuthSettings | null> {
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey, Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as SupabaseAuthSettings;
  } catch {
    return null;
  }
}
