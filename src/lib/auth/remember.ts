/** Persisted account hints — survive sign-out so returning users sign in faster. */

const REMEMBERED_EMAIL_KEY = "resolve.auth.rememberedEmail";
const REMEMBERED_PROVIDER_KEY = "resolve.auth.rememberedProvider";

export type RememberedProvider = "email" | "google" | "github" | "wallet";

export function getRememberedEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function setRememberedEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    /* ignore */
  }
}

export function getRememberedProvider(): RememberedProvider | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(REMEMBERED_PROVIDER_KEY);
    if (v === "email" || v === "google" || v === "github" || v === "wallet") return v;
    return null;
  } catch {
    return null;
  }
}

export function setRememberedProvider(provider: RememberedProvider): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMEMBERED_PROVIDER_KEY, provider);
  } catch {
    /* ignore */
  }
}
