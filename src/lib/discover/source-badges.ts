import type { DiscoverDataSource } from "@/lib/discover/types";

export const SOURCE_BADGE_LABELS: Record<DiscoverDataSource, string> = {
  github: "GitHub scan",
  musicbrainz: "MusicBrainz",
  openalex: "OpenAlex",
  arc: "Arc",
  supabase_ledger: "Supabase ledger",
  community_catalog: "Community catalog",
  catalog_preview: "Catalog preview",
  local_seed: "Local seed",
};

export const SOURCE_BADGE_STYLES: Record<DiscoverDataSource, string> = {
  github: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  musicbrainz: "border-pink-500/30 bg-pink-500/10 text-pink-200",
  openalex: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  arc: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  supabase_ledger: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  community_catalog: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  catalog_preview: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  local_seed: "border-white/20 bg-white/[0.06] text-resolve-muted",
};

export function isPreviewSource(source: DiscoverDataSource): boolean {
  return source === "catalog_preview" || source === "local_seed";
}
