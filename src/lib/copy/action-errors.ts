/** @deprecated Use `@/lib/copy/action-status` — kept for gradual migration */
export { ACTION_STATUS, ACTION_STATUS as ACTION_ERRORS } from "@/lib/copy/action-status";

export function honestInfraError(message: string, fallback = "Could not complete right now."): string {
  if (/connection pool|prisma|database|ECONNRESET|fetch failed/i.test(message)) {
    return fallback;
  }
  return message.length > 0 ? message : fallback;
}
