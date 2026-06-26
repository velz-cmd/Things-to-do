/**
 * Normalized event types — same ledger, many value patterns.
 *
 * Pattern A (essay): consumption → direct creator
 *   scrobble.play, video.watch, contribution.merge, feed.cite
 *
 * Pattern B (extension): downstream value → upstream enabler
 *   dependency.used, package.install, doc.referenced, plugin.executed
 *
 * Both emit SettlementInputEvent. Policies decide amounts; ledger stays connector-agnostic.
 */

export const CONSUMPTION_EVENT_TYPES = [
  "scrobble.play",
  "video.watch",
  "stream.view",
  "contribution.merge",
  "contribution.weighted",
  "feed.cite",
  "photo.view",
  "post.engage",
] as const;

export const UPSTREAM_EVENT_TYPES = [
  "dependency.used",
  "package.install",
  "package.import",
  "doc.referenced",
  "plugin.executed",
  "mcp.invocation",
  "asset.reused",
  "moderation.action",
] as const;

export type ConsumptionEventType = (typeof CONSUMPTION_EVENT_TYPES)[number];
export type UpstreamEventType = (typeof UPSTREAM_EVENT_TYPES)[number];
export type ValueEventType = ConsumptionEventType | UpstreamEventType | string;

/** Optional policy reference — community defines splits; RESOLVE executes. */
export type SettlementPolicyRef = {
  policyId: string;
  ruleLabel?: string;
  splitFromEventId?: string;
};
