/** GitHub login — alphanumeric + hyphens only; never display names with spaces. */
const GITHUB_LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function normalizeGithubLogin(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const candidate = raw.trim().toLowerCase();
  if (/\s/.test(candidate)) return null;
  if (!GITHUB_LOGIN_RE.test(candidate)) return null;
  return candidate;
}
