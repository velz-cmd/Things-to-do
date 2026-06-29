/** Parse user-supplied URLs without throwing — malformed navidrome URLs must not 500 profile APIs. */
export function safeUrlHostname(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    return new URL(raw.trim()).hostname;
  } catch {
    return undefined;
  }
}
