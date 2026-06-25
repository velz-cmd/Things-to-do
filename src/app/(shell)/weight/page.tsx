import { WeightPageClient } from "@/components/resolve/github/weight-page-client";

export const metadata = {
  title: "Weight impact — RESOLVE",
  description:
    "GitHub Phase 1: Sybil Shield, Weight Council, founder intent, and evidence-based Arc settlement.",
};

/** Judge-facing GitHub weight + settlement flow. */
export default function WeightPage() {
  return <WeightPageClient />;
}
