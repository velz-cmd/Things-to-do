import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommunityHome } from "@/components/resolve/communities/community-home";
import { getCommunityBySlug } from "@/lib/communities/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) return { title: "Community — RESOLVE" };
  return {
    title: `${community.name} — RESOLVE`,
    description: community.tagline,
  };
}

export default async function CommunityPage({ params }: Props) {
  const { slug } = await params;
  if (!getCommunityBySlug(slug)) notFound();
  return <CommunityHome slug={slug} />;
}
