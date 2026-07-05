import * as Sentry from "@sentry/nextjs";

/** Log + optional Sentry — never throws. */
export function reportApiError(scope: string, error: unknown, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${scope}]`, message, extra ?? "");

  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.withScope((s) => {
      s.setTag("api_scope", scope);
      if (extra) s.setExtras(extra);
      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(`${scope}: ${message}`, "error");
      }
    });
  }
}
