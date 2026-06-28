/** CRON_SECRET with whitespace trimmed — Vercel rejects raw env if crons are configured. */
export function getCronSecret(): string | undefined {
  const raw = process.env.CRON_SECRET;
  if (!raw) return undefined;
  return raw.trim() || undefined;
}

export function getBootstrapSensorSecret(): string | undefined {
  const raw = process.env.BOOTSTRAP_SENSOR_SECRET;
  if (!raw) return undefined;
  return raw.trim() || undefined;
}

export function getClaimTokenSecret(): string | undefined {
  return (
    process.env.CLAIM_TOKEN_SECRET?.trim() ||
    getCronSecret() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    undefined
  );
}

export function cronSecretHasWhitespace(): boolean {
  const raw = process.env.CRON_SECRET;
  if (!raw) return false;
  return raw !== raw.trim();
}

export function claimTokenSecretHasWhitespace(): boolean {
  const raw = process.env.CLAIM_TOKEN_SECRET;
  if (!raw) return false;
  return raw !== raw.trim();
}

/** Shared cron / operator auth — trims bearer token and secret. */
export function authorizeCronRequest(req: Request): boolean {
  const secret = getCronSecret();
  const bootstrap = getBootstrapSensorSecret();
  const auth = req.headers.get("authorization")?.trim();

  if (secret && auth === `Bearer ${secret}`) return true;
  if (bootstrap && auth === `Bearer ${bootstrap}`) return true;

  const isProd =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  if (!isProd && !secret && !bootstrap) return true;
  return false;
}
