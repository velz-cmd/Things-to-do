import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceFundSurface } from "@/components/resolve/workspace/workspace-fund-surface";

export const metadata: Metadata = {
  title: "Fund — RESOLVE Mission",
  description: "Analyze attribution and authorize settlement.",
};

export default function MissionFundPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading…</p>}>
      <WorkspaceFundSurface />
    </Suspense>
  );
}
