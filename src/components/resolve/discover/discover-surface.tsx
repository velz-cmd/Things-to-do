"use client";

import { DiscoverCoverageIntelligence } from "@/components/resolve/discover/discover-coverage-intelligence";
import type { DiscoverOssIntelligence } from "@/lib/discover/oss-intelligence";

export function DiscoverSurface({
  intelligence,
}: {
  intelligence: DiscoverOssIntelligence;
}) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#050b16] px-4 py-5 sm:px-6 lg:px-8">
      <DiscoverCoverageIntelligence data={intelligence} />
    </main>
  );
}
