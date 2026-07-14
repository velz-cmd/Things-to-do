import type { OutcomeAdapter } from "@/lib/outcomes/adapters/types";
import { peertubeOutcomeAdapter } from "@/lib/outcomes/adapters/peertube/adapter";
import { githubOutcomeAdapter } from "@/lib/outcomes/adapters/github/adapter";

const unavailable = (id: string, label: string, status: OutcomeAdapter["status"]): OutcomeAdapter => ({
  id, label, status, supportedOutcomeTypes: [],
  async validateSource() { return { valid: false, blocker: `${label} is not configured for production verification.` }; },
  async captureBaseline() { throw new Error(`${label} is not configured.`); },
  async synchronize() { throw new Error(`${label} is not configured.`); },
  async verifyOwnership() { return { verified: false, blocker: `${label} ownership verification is unavailable.` }; },
  async verifyIdentity() { return { verified: false, blocker: `${label} identity verification is unavailable.` }; },
  async buildEvidence() { throw new Error(`${label} evidence is unavailable.`); },
});

export const outcomeAdapterRegistry = {
  github: githubOutcomeAdapter,
  peertube: peertubeOutcomeAdapter,
  youtube: unavailable("youtube", "YouTube public metrics", "configuration_required"),
  owncast: unavailable("owncast", "Owncast webhook", "configuration_required"),
  rss: unavailable("rss", "RSS attribution", "planned"),
  "manual-reviewed": unavailable("manual-reviewed", "Manual review", "manual_review"),
} as const satisfies Record<string, OutcomeAdapter>;

export function getOutcomeAdapter(id: string): OutcomeAdapter | null {
  return outcomeAdapterRegistry[id as keyof typeof outcomeAdapterRegistry] ?? null;
}
