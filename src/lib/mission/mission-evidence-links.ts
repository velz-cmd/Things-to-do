import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import type { MissionBlueprintPackage } from "@/lib/mission/mission-blueprint-package";

export type MissionEvidenceLink = {
  label: string;
  href: string;
  kind: "github" | "openalex" | "plays" | "arc" | "community";
};

export function buildMissionEvidenceLinks(pkg: MissionBlueprintPackage): MissionEvidenceLink[] {
  const links: MissionEvidenceLink[] = [];
  const catalog = COMMUNITY_CATALOG.find((c) => c.slug === pkg.communitySlug);

  if (catalog?.connectors.includes("github")) {
    links.push({
      label: `${catalog.name} · GitHub signals`,
      href: `https://github.com/search?q=${encodeURIComponent(catalog.name)}+maintainer&type=repositories`,
      kind: "github",
    });
  }

  if (catalog?.kind === "research" || pkg.objective.toLowerCase().includes("citation")) {
    links.push({
      label: "OpenAlex impact",
      href: `https://openalex.org/works?filter=title.search:${encodeURIComponent(catalog?.name ?? pkg.communitySlug)}`,
      kind: "openalex",
    });
  }

  if (catalog?.kind === "music" || catalog?.connectors.includes("navidrome")) {
    links.push({
      label: "Play attribution bridge",
      href: `/connect/navidrome?community=${encodeURIComponent(pkg.communitySlug)}`,
      kind: "plays",
    });
  }

  links.push({
    label: `${catalog?.name ?? pkg.communityLabel} community console`,
    href: `/communities/${encodeURIComponent(pkg.communitySlug)}`,
    kind: "community",
  });

  return links;
}
