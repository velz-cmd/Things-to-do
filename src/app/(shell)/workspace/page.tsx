import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceBrain } from "@/components/resolve/workspace/workspace-brain";

export const metadata: Metadata = {
  title: "Workspace — RESOLVE",
  description: "Analyze GitHub repositories and distribute capital with evidence.",
};

export default function WorkspacePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading workspace…</p>}>
      <WorkspaceBrain />
    </Suspense>
  );
}
