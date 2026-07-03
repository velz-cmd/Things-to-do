import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverSurface } from "@/components/resolve/discover/discover-surface";

export const metadata: Metadata = {
  title: "Discover — RESOLVE",
  description: "Where should value move next? Find blocked value — fund, build, automate, or claim in one click.",
};

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="resolve-grid-bg min-h-[40vh] px-4 py-16">
          <p className="mx-auto max-w-6xl text-sm text-resolve-muted">Loading Discover…</p>
        </div>
      }
    >
      <DiscoverSurface />
    </Suspense>
  );
}
