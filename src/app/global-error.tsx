"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#060f1c] text-[#f0f5fc] antialiased">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7d8cc4]">
            Something went wrong
          </p>
          <h1 className="mt-3 text-xl font-semibold">RESOLVE hit an unexpected error</h1>
          <p className="mt-3 text-sm text-[#a8b8d4]">
            Your data is safe. One service may be temporarily unavailable — try again.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-xl bg-[#0077b3] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
