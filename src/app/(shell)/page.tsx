import { Suspense } from "react";
import OverviewContent from "./overview-content";

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-deputy-muted">Loading…</div>}>
      <OverviewContent />
    </Suspense>
  );
}
