import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverSurface } from "@/components/resolve/discover/discover-surface";

export const metadata: Metadata = {
  title: "Discover — RESOLVE",
  description: "Where does value already exist?",
};

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-sm text-resolve-muted">Loading Discover…</p>
        </div>
      }
    >
      <DiscoverSurface />
    </Suspense>
  );
}
