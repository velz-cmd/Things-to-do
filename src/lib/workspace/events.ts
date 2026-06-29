/** Human-readable universal events — backend types stay internal. */
export function eventTypeLabel(eventType: string): string {
  const map: Record<string, string> = {
    "contribution.weighted": "Contribution recognized",
    "contribution.merge": "Pull request merged",
    "scrobble.play": "Listen verified",
    "scrobble.credit": "Credit attributed",
    "dependency.used": "Package used downstream",
    "package.install": "Package installed",
    "doc.referenced": "Documentation referenced",
    "feed.cite": "Citation detected",
    "docs.merged": "Documentation merged",
    "security.advisory": "Security advisory closed",
    "citation.verified": "Citation verified",
    "video.watch": "Video watched",
  };
  return map[eventType] ?? "Value recognized";
}

export function explainRecognition(input: {
  eventType: string;
  domain: string;
  context: string;
  status: string;
  amountUsd: number;
  confidence?: number;
}): string {
  const what = eventTypeLabel(input.eventType);
  const conf =
    input.confidence != null ?
      ` · ${Math.round(input.confidence * 100)}% confidence`
    : "";
  return `${input.domain}: ${what} at ${input.context} — $${input.amountUsd.toFixed(4)} ${input.status.replace("_", " ")}${conf}`;
}
