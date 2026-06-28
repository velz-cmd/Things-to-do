/** CRON_SECRET with whitespace trimmed — Vercel rejects raw env if crons are configured. */
export function getCronSecret(): string | undefined {
  const raw = process.env.CRON_SECRET;
  if (!raw) return undefined;
  return raw.trim() || undefined;
}

export function cronSecretHasWhitespace(): boolean {
  const raw = process.env.CRON_SECRET;
  if (!raw) return false;
  return raw !== raw.trim();
}
