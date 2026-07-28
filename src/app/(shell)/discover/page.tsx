import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverSurface } from "@/components/resolve/discover/discover-surface";
import { buildDiscoverOssIntelligence } from "@/lib/discover/oss-intelligence";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Discover — RESOLVE",
  description: "Where should value move next? Find blocked value, fund pools, inspect evidence, or start a Mission.",
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const { repo } = await searchParams;
  const user = await getSessionUser().catch(() => null);
  const intelligence = await buildDiscoverOssIntelligence({
    repository: repo,
    viewerUserId: user?.id ?? null,
  }).catch(() => null);

  return (
    <Suspense
      fallback={
        <div className="resolve-grid-bg min-h-[40vh] px-4 py-16">
          <p className="mx-auto max-w-6xl text-sm text-resolve-muted">Loading Discover…</p>
        </div>
      }
    >
      <DiscoverSurface intelligence={intelligence} />
    </Suspense>
  );
}
