import { EntityIds, parseEntityRef } from "@/lib/domain/entities";

export type EntitySurfaceKind = "repository" | "artist" | "maintainer" | "work" | "community";

/** Map ledger payee → canonical entity id for deep links. */
export function payeeToEntityId(payeeKey: string, payeeKeyType: string): string {
  if (payeeKeyType === "listen_artist") return `creator:${payeeKey.toLowerCase()}`;
  if (payeeKeyType === "github_username") return EntityIds.personGitHub(payeeKey);
  return `payee:${payeeKeyType}:${payeeKey.toLowerCase()}`;
}

/** Parse `/e/...` path segments → canonical entity id. */
export function entityPathToId(parts: string[]): string | null {
  if (!parts.length) return null;
  const [kind, ...rest] = parts.map((p) => decodeURIComponent(p));

  switch (kind) {
    case "repo":
      if (rest.length < 2) return null;
      return EntityIds.repository(rest[0], rest.slice(1).join("/"));
    case "artist":
    case "creator":
      if (!rest.length) return null;
      return `creator:${rest.join("/")}`;
    case "maintainer":
      if (rest[0] === "github" && rest[1]) return EntityIds.personGitHub(rest[1]);
      if (rest[0]) return EntityIds.personGitHub(rest[0]);
      return null;
    case "person":
      if (!rest.length) return null;
      return `person:${rest.join(":")}`;
    case "work":
      if (!rest.length) return null;
      return `work:${rest.join(":")}`;
    case "community":
      if (!rest[0]) return null;
      return EntityIds.community(rest[0]);
    default:
      return null;
  }
}

export function isLinkableEntityId(id: string): boolean {
  return (
    id.startsWith("repo:") ||
    id.startsWith("creator:") ||
    id.startsWith("person:") ||
    id.startsWith("work:") ||
    id.startsWith("community:")
  );
}

/** Canonical entity id → `/e/...` path. */
export function entityIdToPath(id: string): string | null {
  if (!isLinkableEntityId(id)) return null;
  if (id.startsWith("repo:")) {
    const slug = id.slice(5);
    const slash = slug.indexOf("/");
    if (slash === -1) return `/e/repo/${encodeURIComponent(slug)}`;
    return `/e/repo/${encodeURIComponent(slug.slice(0, slash))}/${encodeURIComponent(slug.slice(slash + 1))}`;
  }
  if (id.startsWith("creator:")) {
    return `/e/artist/${encodeURIComponent(id.slice(8))}`;
  }
  if (id.startsWith("person:github:")) {
    return `/e/maintainer/github/${encodeURIComponent(id.slice(14))}`;
  }
  if (id.startsWith("person:")) {
    const rest = id.slice(7);
    return `/e/person/${rest.split(":").map(encodeURIComponent).join("/")}`;
  }
  if (id.startsWith("work:")) {
    const rest = id.slice(5);
    return `/e/work/${rest.split(":").map(encodeURIComponent).join("/")}`;
  }
  if (id.startsWith("community:")) {
    return `/e/community/${encodeURIComponent(id.slice(10))}`;
  }

  const parsed = parseEntityRef(id);
  if (parsed) return `/e/raw/${encodeURIComponent(id)}`;
  return null;
}

export function entitySurfaceKind(id: string): EntitySurfaceKind {
  if (id.startsWith("repo:")) return "repository";
  if (id.startsWith("creator:")) return "artist";
  if (id.startsWith("person:github:") || id.startsWith("person:")) return "maintainer";
  if (id.startsWith("work:")) return "work";
  if (id.startsWith("community:")) return "community";
  return "repository";
}

export const ENTITY_KIND_LABELS: Record<EntitySurfaceKind, string> = {
  repository: "Repository",
  artist: "Artist",
  maintainer: "Maintainer",
  work: "Work",
  community: "Community",
};
