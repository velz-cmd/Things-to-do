"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/resolve/ui/button";

export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[shell-error]", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
        Something went wrong
      </p>
      <h1 className="mt-3 text-xl font-semibold text-white">This page hit an error</h1>
      <p className="mt-3 text-sm text-resolve-muted">
        Your session and wallets are safe. Try again — if it keeps happening, open Capital or
        Discover from the menu.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" variant="secondary" onClick={() => window.location.assign("/")}>
          Go home
        </Button>
      </div>
    </div>
  );
}
