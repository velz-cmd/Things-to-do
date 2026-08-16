import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * TEMPORARY diagnostic buffer alongside Sentry reporting. Remove with the
 * diag route once the first-load failure is fixed.
 *
 * Production Server Component errors are redacted in the response and the
 * Vercel log API is not reachable from this environment, so the only way to
 * see what actually throws is to keep the last few errors in memory and read
 * them back from a route on the same instance.
 */
type CapturedError = {
  at: string;
  message: string;
  name: string;
  frames: string[];
  path?: string;
};

const buffer: CapturedError[] = [];

export function recentServerErrors(): CapturedError[] {
  return buffer;
}

export const onRequestError: typeof Sentry.captureRequestError = (
  error,
  request,
  context,
) => {
  try {
    const err = error as Error;
    buffer.unshift({
      at: new Date().toISOString(),
      name: err?.name ?? "unknown",
      message: String(err?.message ?? error).slice(0, 500),
      frames: (err?.stack ?? "")
        .split("\n")
        .slice(1, 6)
        .map((line) => line.trim().slice(0, 180)),
      path: (request as { path?: string })?.path,
    });
    buffer.length = Math.min(buffer.length, 10);
  } catch {
    /* diagnostics must never mask the original error */
  }
  return Sentry.captureRequestError(error, request, context);
};
