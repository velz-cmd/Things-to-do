import { createHash } from "crypto";
import { prisma } from "@/lib/db";

/** Rolling window for abuse detection. */
export const ABUSE_WINDOW_MS = 8 * 60 * 1000;
/** Max link requests allowed within the abuse window before a block. */
export const ABUSE_MAX_REQUESTS = 6;
/** Block duration after abuse threshold is exceeded. */
export const ABUSE_BLOCK_MS = 10 * 60 * 1000;
/** Minimum wait between link requests for the same email. */
export const MIN_RESEND_INTERVAL_MS = 5 * 60 * 1000;
/** Shown to users — links should be used within this window. */
export const LINK_VALID_MINUTES = 5;

type RateState = {
  requests: number[];
  blockedUntil: number | null;
};

export type EmailRateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      cooldownSeconds: number;
      reason: "interval" | "abuse";
      message: string;
    };

function rateLimitKey(email: string) {
  const hash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `auth.email_rate.${hash.slice(0, 32)}`;
}

function parseState(raw: string | null | undefined): RateState {
  if (!raw) return { requests: [], blockedUntil: null };
  try {
    const parsed = JSON.parse(raw) as RateState;
    return {
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      blockedUntil:
        typeof parsed.blockedUntil === "number" ? parsed.blockedUntil : null,
    };
  } catch {
    return { requests: [], blockedUntil: null };
  }
}

async function loadState(email: string): Promise<RateState> {
  const row = await prisma.appConfig.findUnique({
    where: { key: rateLimitKey(email) },
  });
  return parseState(row?.value);
}

async function saveState(email: string, state: RateState) {
  const windowStart = Date.now() - ABUSE_WINDOW_MS;
  const trimmed: RateState = {
    blockedUntil: state.blockedUntil,
    requests: state.requests.filter((t) => t > windowStart),
  };
  await prisma.appConfig.upsert({
    where: { key: rateLimitKey(email) },
    create: { key: rateLimitKey(email), value: JSON.stringify(trimmed) },
    update: { value: JSON.stringify(trimmed) },
  });
}

function formatWait(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export async function checkEmailLinkRateLimit(
  email: string
): Promise<EmailRateLimitResult> {
  const now = Date.now();
  const state = await loadState(email);
  const windowStart = now - ABUSE_WINDOW_MS;
  const recent = state.requests.filter((t) => t > windowStart);

  if (state.blockedUntil && state.blockedUntil > now) {
    const cooldownSeconds = Math.ceil((state.blockedUntil - now) / 1000);
    return {
      allowed: false,
      cooldownSeconds,
      reason: "abuse",
      message: `Too many sign-in requests. Try again in ${formatWait(cooldownSeconds)}.`,
    };
  }

  if (recent.length >= ABUSE_MAX_REQUESTS) {
    const blockedUntil = now + ABUSE_BLOCK_MS;
    await saveState(email, { requests: recent, blockedUntil });
    const cooldownSeconds = Math.ceil(ABUSE_BLOCK_MS / 1000);
    return {
      allowed: false,
      cooldownSeconds,
      reason: "abuse",
      message: `Too many sign-in links requested. Try again in ${formatWait(cooldownSeconds)}.`,
    };
  }

  const last = recent[recent.length - 1];
  if (last && now - last < MIN_RESEND_INTERVAL_MS) {
    const cooldownSeconds = Math.ceil(
      (MIN_RESEND_INTERVAL_MS - (now - last)) / 1000
    );
    return {
      allowed: false,
      cooldownSeconds,
      reason: "interval",
      message: `Please wait ${formatWait(cooldownSeconds)} before requesting another link.`,
    };
  }

  return { allowed: true };
}

export async function recordEmailLinkRequest(email: string) {
  const now = Date.now();
  const state = await loadState(email);
  const windowStart = now - ABUSE_WINDOW_MS;
  const recent = state.requests.filter((t) => t > windowStart);
  recent.push(now);
  await saveState(email, { requests: recent, blockedUntil: null });
}
