"use client";

import clsx from "clsx";
import {
  BookOpen,
  Code2,
  Landmark,
  Music2,
  PlaySquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { TrendingValueGap } from "@/lib/discover/types";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";

const SLUG_LABELS: Record<string, string> = {
  jellyfin: "JF",
  linux: "LX",
  navidrome: "ND",
  react: "R",
  "independent-music": "IM",
  "open-research": "OA",
  "open-writers": "OW",
};

function iconForGap(gap: TrendingValueGap) {
  if (gap.templateId === "security-fund") return ShieldCheck;
  if (gap.templateId === "citation-toll") return BookOpen;
  if (gap.templateId === "video-royalties") return PlaySquare;
  if (gap.templateId === "user-centric-royalties") return Music2;
  if (gap.domain === "oss") return Code2;
  if (gap.domain === "music") return Music2;
  if (gap.domain === "research") return BookOpen;
  if (gap.domain === "dao") return Landmark;
  return Users;
}

function accentForGap(gap: TrendingValueGap): string {
  if (gap.domain === "oss") return "border-sky-400/25 bg-sky-400/10 text-sky-100";
  if (gap.domain === "music") return "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100";
  if (gap.domain === "research") return "border-indigo-400/25 bg-indigo-400/10 text-indigo-100";
  if (gap.domain === "dao") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  if (gap.domain === "community") return "border-violet-400/25 bg-violet-400/10 text-violet-100";
  return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
}

export function DiscoverCommunityLogo({
  gap,
  className,
}: {
  gap: TrendingValueGap;
  className?: string;
}) {
  const Icon = iconForGap(gap);
  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  const profileInitials = profile?.product
    ?.split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const label =
    (gap.communitySlug ? SLUG_LABELS[gap.communitySlug] : undefined) ??
    profileInitials ??
    gap.domain.slice(0, 2).toUpperCase();

  return (
    <div
      className={clsx(
        "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        accentForGap(gap),
        className,
      )}
      title={profile?.product ?? gap.productLabel ?? gap.communitySlug ?? gap.domain}
      aria-hidden
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_45%)]" />
      <Icon className="relative h-5 w-5" strokeWidth={1.85} />
      <span className="absolute bottom-1 right-1 rounded bg-black/45 px-1 text-[8px] font-bold leading-3 text-white/85">
        {label}
      </span>
    </div>
  );
}
