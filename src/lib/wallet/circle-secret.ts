/** Entity secret helpers without DB imports (safe for CLI scripts). */

/** Circle entity secrets are 64-char hex; recovery exports sometimes include a colon. */
export function normalizeCircleEntitySecret(
  raw: string | undefined | null,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const hex = trimmed.replace(/:/g, "");
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return hex.toLowerCase();
  return null;
}

export function isProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}
