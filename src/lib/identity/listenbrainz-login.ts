/** ListenBrainz/MusicBrainz username — no display names with spaces. */
const LB_USERNAME_RE = /^[a-z0-9_-]{1,58}$/i;

export function normalizeListenBrainzUsername(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  const candidate = raw.trim().toLowerCase();
  if (/\s/.test(candidate)) return null;
  if (!LB_USERNAME_RE.test(candidate)) return null;
  return candidate;
}
