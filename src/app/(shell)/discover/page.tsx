import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverSurface } from "@/components/resolve/discover/discover-surface";

export const metadata: Metadata = {
  title: "Discover — RESOLVE",
  description: "Where does value already exist?",
};

export default function DiscoverPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading…</p>}>
      <DiscoverSurface />
    </Suspense>
  );
}
