"use client";

import Link from "next/link";
import { WorkspaceFund } from "@/components/resolve/workspace/workspace-fund";

/** Fund flow — action from Mission, not a top-level tab */
export function WorkspaceFundSurface() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
      <header className="mb-8">
        <Link href="/control" className="text-xs text-resolve-accent hover:underline">
          ← Back to Mission
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">Fund a repository</h1>
        <p className="mt-2 max-w-xl text-sm text-resolve-muted">
          Analyze attribution, authorize from treasury, settle in USDC — you approve every step.
        </p>
      </header>
      <WorkspaceFund />
    </div>
  );
}
