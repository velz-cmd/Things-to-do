import type { Metadata } from "next";
import { Suspense } from "react";
import { MissionCompiler } from "@/components/resolve/mission-control/mission-compiler";

export const metadata: Metadata = {
  title: "Mission | RESOLVE",
  description:
    "Compile connected evidence into reviewable decisions, simulations, Blueprints, and approved handoffs.",
};

export default function MissionPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading Mission...</p>}>
      <MissionCompiler />
    </Suspense>
  );
}
