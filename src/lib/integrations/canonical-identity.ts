/**
 * Canonical identity helpers for the shared Discover market index.
 *
 * The npm/Libraries.io false-attribution bug (react-admin's downloads
 * shown as navidrome's) happened because two different connectors each
 * had their own copy of "does this repository link match the one I'm
 * looking for" - one used substring `.includes()`, the other had none at
 * all. Centralizing that check here means every connector that needs to
 * prove "this external record genuinely belongs to this canonical
 * subject" uses the exact same rule, and a fix to the rule fixes every
 * caller at once instead of requiring the same bug to be found and fixed
 * three separate times.
 *
 * Rule: identity before metrics. No external metric (downloads, citation
 * count, dependents, pulls) may be attached to a canonical subject until
 * that subject's identity is proven exactly - never inferred from search
 * relevance ranking, title similarity, or substring containment.
 */

/** `owner/repo` for a GitHub repository, normalized to lowercase. */
export function canonicalGithubRepoId(owner: string, repo: string): string {
  return `github.com/${owner}/${repo}`.trim().toLowerCase();
}

/**
 * Normalizes a repository URL/link (as returned by npm, Libraries.io, or
 * similar registries) into the same `host/owner/repo` shape produced by
 * canonicalGithubRepoId, so the two can be compared for exact equality.
 * Strips the `git+` prefix, `.git` suffix, and protocol - nothing else.
 * Returns null for anything that isn't parseable as a bare host/path.
 */
export function normalizeRepositoryLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const normalized = link
    .trim()
    .replace(/^git\+/i, "")
    .replace(/\.git$/i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
  return normalized || null;
}

/**
 * True only when `link` resolves to the exact same GitHub repository as
 * `owner/repo` - never a substring match, never a fuzzy/ranked match.
 */
export function repositoryLinkMatchesGithub(
  link: string | null | undefined,
  owner: string,
  repo: string,
): boolean {
  const normalized = normalizeRepositoryLink(link);
  if (!normalized) return false;
  return normalized === canonicalGithubRepoId(owner, repo);
}

/**
 * Normalizes a DOI to its bare form (no `https://doi.org/` prefix, no
 * case differences) so the same work observed via Crossref and OpenAlex
 * resolves to one canonical identity instead of two market records.
 */
export function normalizeDoi(doi: string): string {
  return doi.trim().replace(/^https?:\/\/doi\.org\//i, "").toLowerCase();
}

/**
 * Normalizes an arXiv identifier to its bare form (no `arXiv:` prefix, no
 * `https://arxiv.org/abs/` URL, version suffix stripped so v1/v2/v3 of the
 * same preprint resolve to one canonical identity).
 */
export function normalizeArxivId(id: string): string {
  return id
    .trim()
    .replace(/^arxiv:/i, "")
    .replace(/^https?:\/\/arxiv\.org\/abs\//i, "")
    .replace(/v\d+$/i, "")
    .toLowerCase();
}

/** Bare OpenAlex work ID (strips the `https://openalex.org/` URL form). */
export function normalizeOpenAlexId(id: string): string {
  return id.trim().replace(/^https?:\/\/openalex\.org\//i, "").toUpperCase();
}

/**
 * Canonical identity for one observed media playback/recording event.
 * Prefers the MusicBrainz recording ID when a connector supplied one -
 * the only identity strong enough to be trusted across sources. Title +
 * artist alone is not strong identity (two different artists can share a
 * track title), so the fallback also folds in the exact observation
 * timestamp rather than deduplicating by title/artist text.
 */
export function canonicalMediaId(input: {
  recordingMbid?: string | null;
  artistName: string;
  trackTitle: string;
  observedAt: string;
}): { id: string; strong: boolean } {
  if (input.recordingMbid) {
    return { id: `mbid:${input.recordingMbid.trim().toLowerCase()}`, strong: true };
  }
  return {
    id: `listen:${input.artistName.trim().toLowerCase()}:${input.trackTitle.trim().toLowerCase()}:${input.observedAt}`,
    strong: false,
  };
}
