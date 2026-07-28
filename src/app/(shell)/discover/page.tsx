import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverSurface } from "@/components/resolve/discover/discover-surface";
import { PrimaryRouteLoading } from "@/components/resolve/layout/primary-route-loading";
import { buildDiscoverOssIntelligence } from "@/lib/discover/oss-intelligence";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Discover — RESOLVE",
  description: "Where should value move next? Find blocked value, fund pools, inspect evidence, or start a Mission.",
};

type DiscoverPageProps = {
  searchParams: Promise<{ repo?: string }>;
};

async function DiscoverContent({ searchParams }: DiscoverPageProps) {
  const { repo } = await searchParams;
  const user = await getSessionUser().catch(() => null);
  const intelligence = await buildDiscoverOssIntelligence({
    repository: repo,
    viewerUserId: user?.id ?? null,
  }).catch(() => null);

  return <DiscoverSurface intelligence={intelligence} />;
}

export default function DiscoverPage(props: DiscoverPageProps) {
  return (
    <Suspense fallback={<PrimaryRouteLoading label="Loading Discover" />}>
      <DiscoverContent {...props} />
    </Suspense>
  );
}
