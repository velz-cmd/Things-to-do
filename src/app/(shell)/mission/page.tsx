import type { Metadata } from "next";
import { Suspense } from "react";
import { MissionCompiler } from "@/components/resolve/mission-control/mission-compiler";

export const metadata: Metadata = {
  title: "Mission — RESOLVE",
  description:
    "Intelligence workspace for the open internet. Ask about value, risk, funding, or claims — approve when ready.",
};

export default function MissionPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading mission…</p>}>
      <MissionCompiler />
    </Suspense>
  );
}
