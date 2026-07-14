import type { z } from "zod";

export type ProductOwner =
  | "discover"
  | "mission"
  | "communities"
  | "capital"
  | "earn"
  | "profile";

export type ActionLifecycle =
  | "idle"
  | "validating"
  | "optimistic"
  | "submitting"
  | "pending_external"
  | "confirmed"
  | "sync_failed"
  | "rejected";

export type ResolveActionContext = {
  userId: string | null;
  role: string;
  correlationId: string;
  idempotencyKey: string;
  returnTo?: string;
  capabilities?: ReadonlySet<string>;
};

export type ResolveActionResult<T> = {
  state: Exclude<ActionLifecycle, "idle" | "validating" | "submitting">;
  data?: T;
  userMessage: string;
  technicalDetails?: string;
  retryable: boolean;
  nextActionId?: ResolveActionId;
  receiptId?: string;
};

export type ActionPrecondition = {
  allowed: boolean;
  reason?: string;
  recoveryActionId?: ResolveActionId;
};

export type ActionExecution =
  | { kind: "navigation"; destination: string }
  | { kind: "mutation"; endpoint: string; method: "POST" | "PATCH" | "DELETE" }
  | { kind: "client"; handler: string };

export type ActionDefinition<Input = unknown, Output = unknown> = {
  id: ResolveActionId;
  label: string;
  owner: ProductOwner;
  inputSchema: z.ZodType<Input>;
  roles: readonly string[];
  execution: ActionExecution;
  requiresAuth: boolean;
  risk: "read" | "write" | "money";
  recoveryActionId?: ResolveActionId;
  affectedQueryKeys: readonly string[];
  auditEvent: string;
  getPreconditions(
    input: Input,
    context: ResolveActionContext,
  ): Promise<ActionPrecondition>;
  getOptimisticPatch(input: Input): unknown;
  execute(
    input: Input,
    context: ResolveActionContext,
  ): Promise<ResolveActionResult<Output>>;
};

export const RESOLVE_ACTION_IDS = [
  "asset.register",
  "asset.verify_ownership",
  "campaign.create_draft",
  "campaign.simulate",
  "campaign.approve_blueprint",
  "campaign.create_funding_requirement",
  "campaign.publish",
  "campaign.pause",
  "campaign.resume",
  "campaign.close",
  "campaign.join",
  "campaign.leave",
  "submission.create",
  "submission.update",
  "submission.withdraw",
  "submission.submit_for_verification",
  "outcome.capture_baseline",
  "outcome.synchronize",
  "outcome.verify",
  "outcome.report_conflict",
  "policy.create_version",
  "policy.preview",
  "policy.activate",
  "earning.open",
  "earning.claim",
  "community.install",
  "community.open",
  "community.follow",
  "community.export",
  "community.refresh",
  "source.connect",
  "source.sync",
  "source.reconnect",
  "source.disconnect",
  "source.view_status",
  "identity.claim",
  "identity.inspect",
  "identity.confirm_match",
  "identity.reject_match",
  "identity.request_creator_confirmation",
  "identity.defer",
  "identity.submit_proof",
  "identity.set_payout_destination",
  "program.create_draft",
  "program.update_policy",
  "program.simulate",
  "program.activate",
  "program.pause",
  "program.resume",
  "program.archive",
  "program.open_in_discover",
  "program.open_passport",
  "obligation.review",
  "obligation.open_evidence",
  "obligation.request_identity",
  "obligation.prepare_settlement",
  "mission.create",
  "mission.run_free_analysis",
  "mission.purchase_signal",
  "mission.generate_blueprint",
  "mission.simulate",
  "mission.prepare_authorization",
  "capital.open_funding",
  "capital.refresh_snapshot",
  "capital.select_wallet",
  "capital.submit_funding",
  "capital.authorize_settlement",
  "capital.retry_confirmation",
  "capital.claim_earning",
  "receipt.open",
  "receipt.copy_reference",
  "receipt.open_arcscan",
  "profile.manage_connections",
] as const;

export type ResolveActionId = (typeof RESOLVE_ACTION_IDS)[number];
