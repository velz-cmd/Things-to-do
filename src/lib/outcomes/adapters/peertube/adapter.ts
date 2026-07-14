import { createHash } from "node:crypto";
import type { OutcomeAdapter, OutcomeSnapshotValue } from "@/lib/outcomes/adapters/types";
import { calculateIncrementalUnits } from "@/lib/outcomes/campaign-lifecycle";

type PeerTubeVideo = { uuid: string; name: string; description?: string; views: number; url?: string; account?: { name?: string }; channel?: { name?: string } };

function endpoint(rawUrl: string) {
  const url = new URL(rawUrl);
  const id = url.pathname.match(/\/w\/([^/]+)/)?.[1] ?? url.pathname.match(/\/videos\/watch\/([^/]+)/)?.[1];
  if (!id) throw new Error("Use a canonical PeerTube watch URL.");
  return { api: `${url.origin}/api/v1/videos/${encodeURIComponent(id)}`, id, canonicalUrl: rawUrl };
}

async function loadVideo(rawUrl: string): Promise<PeerTubeVideo> {
  const { api } = endpoint(rawUrl);
  const response = await fetch(api, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`PeerTube returned ${response.status}.`);
  return response.json() as Promise<PeerTubeVideo>;
}

function snapshot(url: string, video: PeerTubeVideo): OutcomeSnapshotValue {
  const observedAt = new Date().toISOString();
  // The hash identifies provider state, not the polling attempt. Repeated
  // synchronization of an unchanged video must remain idempotent.
  const contentHash = createHash("sha256").update(`${video.uuid}:${video.views}`).digest("hex");
  return { adapterId: "peertube", sourceObjectId: video.uuid, objectUrl: video.url ?? url, objectLabel: video.name, unitType: "views", value: BigInt(Math.max(0, video.views)), observedAt, contentHash };
}

export const peertubeOutcomeAdapter: OutcomeAdapter = {
  id: "peertube",
  label: "PeerTube public metrics",
  status: "live",
  supportedOutcomeTypes: ["clip_published", "qualified_view"],
  async validateSource({ url }) {
    try { const video = await loadVideo(url); return { valid: true, externalId: video.uuid, title: video.name }; }
    catch (error) { return { valid: false, blocker: error instanceof Error ? error.message : "PeerTube source unavailable." }; }
  },
  async captureBaseline({ url }) { return snapshot(url, await loadVideo(url)); },
  async synchronize({ url, baseline }) {
    const current = snapshot(url, await loadVideo(url));
    if (current.value < baseline.value) return { snapshot: current, incrementalValue: BigInt(0), conflict: "The current metric is lower than the accepted baseline and requires review." };
    return { snapshot: current, incrementalValue: calculateIncrementalUnits(current.value, baseline.value) };
  },
  async verifyOwnership({ url, challenge }) {
    try {
      const video = await loadVideo(url);
      if (!video.description?.includes(challenge)) return { verified: false, blocker: "Add the RESOLVE verification code to the PeerTube video description, then retry." };
      return { verified: true, proof: { provider: "peertube", videoId: video.uuid, account: video.account?.name ?? null, channel: video.channel?.name ?? null } };
    } catch (error) { return { verified: false, blocker: error instanceof Error ? error.message : "PeerTube ownership proof is unavailable." }; }
  },
  async verifyIdentity({ externalIdentity }) { return externalIdentity ? { verified: true } : { verified: false, blocker: "Connect or verify the PeerTube account used for the submission." }; },
  async buildEvidence({ snapshot: value }) { return { provider: "peertube", sourceUrl: value.objectUrl, state: "direct", contentHash: value.contentHash, payload: { sourceObjectId: value.sourceObjectId, unitType: value.unitType, value: value.value.toString(), observedAt: value.observedAt } }; },
};
