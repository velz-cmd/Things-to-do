import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverSurface } from "@/components/resolve/discover/discover-surface";
import { PrimaryRouteLoading } from "@/components/resolve/layout/primary-route-loading";
import {
  buildDiscoverOssIntelligence,
  emptyDiscoverOssIntelligence,
} from "@/lib/discover/oss-intelligence";
import { getSessionUser } from "@/lib/auth/session";
import {
  discoverIntelligenceTimeoutMs,
  withTimeout,
} from "@/lib/discover/fetch-timeout";

export const metadata: Metadata = {
  title: "Discover — RESOLVE",
  description: "Where should value move next? Find blocked value, fund pools, inspect evidence, or start a Mission.",
};

type DiscoverPageProps = {
  searchParams: Promise<{ repo?: string }>;
};

async function DiscoverContent({ searchParams }: DiscoverPageProps) {
  const { repo } = await searchParams;
  const degraded = {
    ...emptyDiscoverOssIntelligence(),
    degradedSources: ["discover_intelligence"],
  };
  const user = await withTimeout(getSessionUser().catch(() => null), 1_200, null);
  const intelligence = await withTimeout(
    buildDiscoverOssIntelligence({
      repository: repo,
      viewerUserId: user?.id ?? null,
    }).catch(() => degraded),
    discoverIntelligenceTimeoutMs(repo),
    degraded,
  );

  return <DiscoverSurface intelligence={intelligence} />;
}

export default function DiscoverPage(props: DiscoverPageProps) {
  return (
    <Suspense fallback={<PrimaryRouteLoading label="Loading Discover" />}>
      <DiscoverContent {...props} />
    </Suspense>
  );
}
