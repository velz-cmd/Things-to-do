import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverMarketplace } from "@/components/resolve/discover/marketplace/discover-marketplace";
import { DiscoverMarketplaceSkeleton } from "@/components/resolve/discover/marketplace/discover-marketplace-skeleton";
import {
  parseDiscoverView,
  parseOpportunityFilters,
  type DiscoverSearchParams,
} from "@/lib/discover/marketplace/filters";
import { loadDiscoverPageData } from "@/lib/discover/marketplace/query";

export const metadata: Metadata = {
  title: "Discover - RESOLVE",
  description: "Find people, verified work, Pools, Programs, Communities and confirmed outcomes.",
};

type DiscoverPageProps = {
  searchParams: Promise<DiscoverSearchParams>;
};

async function DiscoverContent({ searchParams }: DiscoverPageProps) {
  const params = await searchParams;
  const view = parseDiscoverView(params.view);
  const filters = parseOpportunityFilters(params);
  const data = await loadDiscoverPageData(filters, view);

  return <DiscoverMarketplace data={data} filters={filters} />;
}

export default function DiscoverPage(props: DiscoverPageProps) {
  return (
    <Suspense fallback={<DiscoverMarketplaceSkeleton />}>
      <DiscoverContent {...props} />
    </Suspense>
  );
}
