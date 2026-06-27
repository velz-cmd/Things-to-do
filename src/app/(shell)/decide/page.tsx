import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceFundSurface } from "@/components/resolve/workspace/workspace-fund-surface";

export const metadata: Metadata = {
  title: "Decide — RESOLVE",
  description: "What needs funding? Evidence-backed allocation and authorization.",
};

export default function DecidePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading…</p>}>
      <WorkspaceFundSurface />
    </Suspense>
  );
}
