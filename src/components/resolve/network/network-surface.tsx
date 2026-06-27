"use client";

import Link from "next/link";
import { ValueFeed } from "@/components/resolve/workspace/workspace-context-feed";

/** Network — what is happening globally? */
export function NetworkSurface() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <header className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Network
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          What is happening globally?
        </h1>
        <p className="mt-2 text-sm text-resolve-muted">
          Live timeline — recognition, funding, settlement. Global value graph ships with Layer 4.
        </p>
      </header>
      <ValueFeed />
      <p className="mt-8 text-center text-xs text-resolve-muted-dim">
        <Link href="/discover" className="text-resolve-accent hover:underline">
          Discover where value exists →
        </Link>
      </p>
    </div>
  );
}
