import { Suspense } from "react";
import { DiscoverSurface } from "@/components/resolve/discover/discover-surface";

export const metadata = {
  title: "Observe — RESOLVE",
  description: "Where value already exists across open ecosystems.",
};

export default function DiscoverPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading…</p>}>
      <DiscoverSurface />
    </Suspense>
  );
}
