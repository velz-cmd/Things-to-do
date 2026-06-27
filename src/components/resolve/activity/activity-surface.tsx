"use client";

import Link from "next/link";
import { ValueFeed } from "@/components/resolve/workspace/workspace-context-feed";

/** Global value graph — timeline only. No duplicate workspace dashboards. */
export function ActivitySurface() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <header className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Network feed
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Value in motion</h1>
        <p className="mt-2 text-sm text-resolve-muted">
          Real events from connected ecosystems — recognition, funding, settlement.
        </p>
      </header>
      <ValueFeed />
      <p className="mt-8 text-center text-xs text-resolve-muted-dim">
        <Link href="/profile" className="text-resolve-accent hover:underline">
          Manage sensors & identity →
        </Link>
      </p>
    </div>
  );
}
