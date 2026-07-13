import {
  AudioWaveform,
  BookOpenText,
  Code2,
  FilePenLine,
  PlaySquare,
  ServerCog,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";

const SLUG_ICONS: Record<string, LucideIcon> = {
  "independent-music": AudioWaveform,
  navidrome: ServerCog,
  react: Code2,
  linux: ShieldCheck,
  "open-research": BookOpenText,
  jellyfin: PlaySquare,
  "open-writers": FilePenLine,
};

const KIND_ICONS: Record<string, LucideIcon> = {
  music: AudioWaveform,
  oss: Code2,
  research: BookOpenText,
  media: PlaySquare,
  education: FilePenLine,
  protocol: ShieldCheck,
};

export function communityIconFor(slug: string, kind: string): LucideIcon {
  return SLUG_ICONS[slug] ?? KIND_ICONS[kind] ?? ServerCog;
}

export function CommunityDomainIcon({
  slug,
  kind,
  className,
}: {
  slug: string;
  kind: string;
  className?: string;
}) {
  const Icon = communityIconFor(slug, kind);
  return <Icon className={clsx("h-5 w-5", className)} strokeWidth={1.7} />;
}
