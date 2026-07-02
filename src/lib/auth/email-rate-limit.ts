import { createHash } from "crypto";
import { prisma } from "@/lib/db";

/** Light anti-spam — brief pause between resends for the same inbox. */
export const MIN_RESEND_INTERVAL_MS = 15 * 1000;
/** Shown to users — magic links should be used within this window. */
export const LINK_VALID_MINUTES = 15;

type RateState = {
  requests: number[];
};

export type EmailRateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      cooldownSeconds: number;
      reason: "interval";
      message: string;
    };

function rateLimitKey(email: string) {
  const hash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `auth.email_rate.${hash.slice(0, 32)}`;
}

function parseState(raw: string | null | undefined): RateState {
  if (!raw) return { requests: [] };
  try {
    const parsed = JSON.parse(raw) as RateState;
    return {
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
    };
  } catch {
    return { requests: [] };
  }
}

async function loadState(email: string): Promise<RateState> {
  const row = await prisma.appConfig.findUnique({
    where: { key: rateLimitKey(email) },
  });
  return parseState(row?.value);
}

async function saveState(email: string, state: RateState) {
  const windowStart = Date.now() - 60 * 60 * 1000;
  const trimmed: RateState = {
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
  const recent = state.requests;

  const last = recent[recent.length - 1];
  if (last && now - last < MIN_RESEND_INTERVAL_MS) {
    const cooldownSeconds = Math.ceil(
      (MIN_RESEND_INTERVAL_MS - (now - last)) / 1000
    );
    return {
      allowed: false,
      cooldownSeconds,
      reason: "interval",
      message: `Link sent — check your inbox. You can resend in ${formatWait(cooldownSeconds)}.`,
    };
  }

  return { allowed: true };
}

export async function recordEmailLinkRequest(email: string) {
  const now = Date.now();
  const state = await loadState(email);
  const windowStart = now - 60 * 60 * 1000;
  const recent = state.requests.filter((t) => t > windowStart);
  recent.push(now);
  await saveState(email, { requests: recent });
}
