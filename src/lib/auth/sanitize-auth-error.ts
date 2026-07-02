import { isMissingTableError, isPrismaUnavailableError } from "../db/prisma-errors";

/** Never expose Prisma/SQL internals in auth UI — Linear/Stripe pattern. */
export function sanitizeAuthApiError(
  error: unknown,
  fallback = "Something went wrong. Try again in a moment.",
): string {
  if (isMissingTableError(error) || isPrismaUnavailableError(error)) {
    return "Account service is updating. Try again in a minute, or use wallet sign-in.";
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("prisma") ||
    lower.includes("invalid `") ||
    lower.includes("invocation") ||
    lower.includes("does not exist") ||
    lower.includes("relation ") ||
    lower.includes("column ")
  ) {
    return fallback;
  }

  if (lower.includes("rate limit")) {
    return "Too many requests. Wait a few minutes and try again.";
  }

  return message.length > 180 ? fallback : message;
}
