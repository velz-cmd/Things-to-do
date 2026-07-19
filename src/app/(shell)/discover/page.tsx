import type { Metadata } from "next";
import { DiscoverOpenSourceIntelligence } from "@/components/resolve/discover/discover-open-source-intelligence";
import { buildDiscoverOssIntelligence } from "@/lib/discover/oss-intelligence";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Proof-to-Pool economic intelligence — RESOLVE",
  description: "Turn verified ecosystem work into attribution, policy coverage, communal funding milestones, and public settlement receipts.",
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const { repo } = await searchParams;
  const user = await getSessionUser().catch(() => null);
  const intelligence = await buildDiscoverOssIntelligence({ repository: repo, viewerUserId: user?.id ?? null });
  return <DiscoverOpenSourceIntelligence key={intelligence.selected?.fullName ?? "empty"} initialData={intelligence} />;
}
