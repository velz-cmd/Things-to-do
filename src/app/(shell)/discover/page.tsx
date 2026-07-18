import type { Metadata } from "next";
import { DiscoverOpenSourceIntelligence } from "@/components/resolve/discover/discover-open-source-intelligence";
import { buildDiscoverOssIntelligence } from "@/lib/discover/oss-intelligence";

export const metadata: Metadata = {
  title: "Open-source funding intelligence — RESOLVE",
  description: "See which repository work is accepted, what current programs miss, and where funding should go next.",
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const { repo } = await searchParams;
  const intelligence = await buildDiscoverOssIntelligence({ repository: repo });
  return <DiscoverOpenSourceIntelligence key={intelligence.selected?.fullName ?? "empty"} initialData={intelligence} />;
}
