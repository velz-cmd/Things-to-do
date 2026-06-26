import { Suspense } from "react";
import { ClaimEntry } from "@/components/resolve/claim/claim-entry";

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-12 text-sm text-resolve-muted">
          Loading…
        </div>
      }
    >
      <ClaimEntry />
    </Suspense>
  );
}
