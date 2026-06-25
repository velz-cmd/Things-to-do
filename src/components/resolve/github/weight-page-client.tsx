"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GitHubFundingPanel } from "@/components/resolve/github/github-funding-panel";

function WeightFromQuery() {
  const params = useSearchParams();
  return (
    <GitHubFundingPanel
      initialOwner={params.get("owner") ?? undefined}
      initialRepo={params.get("repo") ?? undefined}
    />
  );
}

export function WeightPageClient() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading…</p>}>
      <WeightFromQuery />
    </Suspense>
  );
}
