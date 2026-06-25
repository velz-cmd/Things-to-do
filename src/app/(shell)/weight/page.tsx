import { DistributePanel } from "@/components/resolve/missions/distribute-panel";

export const metadata = {
  title: "Weight impact — RESOLVE",
  description: "Verify contribution weights, challenge splits, settle proportionally on Arc.",
};

/** Judge-facing weight flow — not buried in mission control. */
export default function WeightPage() {
  return <DistributePanel />;
}
