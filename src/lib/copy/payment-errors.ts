import { circleUserMessage } from "@/lib/wallet/circle-errors";

/** Map server errors to user-safe payment copy (Discover, Capital, Mission). */
export function publicPaymentError(error: unknown, fallback = "Payment could not complete."): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const userCircle = circleUserMessage(error);

  if (userCircle !== message && /entity secret|Circle error 156/i.test(message)) {
    return `${userCircle} Your balance was not charged.`;
  }

  if (/connection pool|prisma|timeout|timed out|database|ECONNRESET|fetch failed|Arc RPC/i.test(message)) {
    return fallback;
  }

  if (/entity secret|CIRCLE_ENTITY|Circle client not configured|Circle is not configured/i.test(message)) {
    return `${circleUserMessage(message)} Your balance was not charged.`;
  }

  if (message.length > 0) return message;
  return fallback;
}
