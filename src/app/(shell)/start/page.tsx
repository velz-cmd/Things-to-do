import { Suspense } from "react";
import { StartWorkspace } from "@/components/resolve/start/start-workspace";

export default function StartPage() {
  return (
    <Suspense
      fallback={
        <div className="resolve-grid-bg p-8 pb-32 text-resolve-muted">Loading…</div>
      }
    >
      <StartWorkspace />
    </Suspense>
  );
}
