/** Strip engineer-facing tokens from user-visible copy. */
export function humanizeUpstreamLabel(raw: string): string {
  return raw
    .replace(/\bAPI\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s*·\s*/g, " · ")
    .trim();
}

export function humanizeExtractionSources(sources: string[]): string {
  return humanizeUpstreamLabel(sources.join(" · "));
}
