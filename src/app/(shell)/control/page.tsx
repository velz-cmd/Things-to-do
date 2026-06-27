import type { Metadata } from "next";
import { Suspense } from "react";
import { MissionControl } from "@/components/resolve/mission-control/mission-control";

export const metadata: Metadata = {
  title: "Mission Control — RESOLVE",
  description: "Economic reasoning engine for open ecosystems.",
};

export default function ControlPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading mission control…</p>}>
      <MissionControl />
    </Suspense>
  );
}
