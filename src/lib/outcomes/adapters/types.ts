export type OutcomeEventType =
  | "clip_published" | "qualified_view" | "qualified_watch_time" | "approved_translation"
  | "newsletter_inclusion" | "citation_observed" | "repository_pr_merged" | "documentation_merged"
  | "issue_resolved" | "security_fix_accepted" | "livestream_presence" | "listen_completed"
  | "community_task_completed" | "agent_resource_used";

export type OutcomeSnapshotValue = {
  adapterId: string;
  sourceObjectId: string;
  objectUrl: string;
  objectLabel: string;
  unitType: "events" | "views" | "seconds" | "minutes" | "citations" | "uses";
  value: bigint;
  observedAt: string;
  contentHash: string;
};

export type OutcomeEvidenceValue = {
  provider: string;
  sourceUrl: string;
  state: "direct" | "corroborated" | "single_source" | "manual_review" | "conflicted" | "rejected";
  contentHash: string;
  payload: Record<string, unknown>;
};

export type OutcomeAdapter = {
  id: string;
  label: string;
  status: "live" | "configuration_required" | "manual_review" | "planned";
  supportedOutcomeTypes: readonly OutcomeEventType[];
  validateSource(input: { url: string }): Promise<{ valid: boolean; externalId?: string; title?: string; blocker?: string }>;
  captureBaseline(input: { url: string }): Promise<OutcomeSnapshotValue>;
  synchronize(input: { url: string; baseline: OutcomeSnapshotValue }): Promise<{ snapshot: OutcomeSnapshotValue; incrementalValue: bigint; conflict?: string }>;
  verifyOwnership(input: { url: string; challenge: string }): Promise<{ verified: boolean; proof?: Record<string, unknown>; blocker?: string }>;
  verifyIdentity(input: { externalIdentity?: string }): Promise<{ verified: boolean; blocker?: string }>;
  buildEvidence(input: { snapshot: OutcomeSnapshotValue }): Promise<OutcomeEvidenceValue>;
};
