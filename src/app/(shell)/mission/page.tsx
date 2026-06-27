import type { Metadata } from "next";
import { Suspense } from "react";
import { MissionControl } from "@/components/resolve/mission-control/mission-control";

export const metadata: Metadata = {
  title: "Mission — RESOLVE",
  description: "What should I do? An AI workspace for economic decisions.",
};

export default function MissionPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading mission…</p>}>
      <MissionControl />
    </Suspense>
  );
}
