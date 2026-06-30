import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverSurface } from "@/components/resolve/discover/discover-surface";

export const metadata: Metadata = {
  title: "Discover — RESOLVE",
  description: "What do you want to do? Pick a job — claim, fund, connect, or observe.",
};

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="discover-on-canvas mx-auto max-w-6xl px-4 py-8">
          <p className="discover-muted text-sm">Loading Discover…</p>
        </div>
      }
    >
      <DiscoverSurface />
    </Suspense>
  );
}
