/** Community slug from a Discover navigation target, if any. */
export function communitySlugFromDiscoverTarget(target?: string | null): string | null {
  if (!target) return null;
  return target.match(/\/communities\/([^/#?]+)/)?.[1] ?? null;
}
