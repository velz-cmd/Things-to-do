/** Parse owner/repo from pasted GitHub URLs or plain text. */
export function parseRepoInput(raw: string): { owner: string; repo: string } | null {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return null;

  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i,
  );
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, "") };
  }

  const slash = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (slash) {
    return { owner: slash[1], repo: slash[2] };
  }

  return null;
}
