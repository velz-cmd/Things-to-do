import { z } from "zod";
import {
  RESOLVE_ACTION_IDS,
  type ActionDefinition,
  type ActionExecution,
  type ProductOwner,
  type ResolveActionContext,
  type ResolveActionId,
} from "@/lib/actions/types";

export { RESOLVE_ACTION_IDS } from "@/lib/actions/types";
export type {
  ActionDefinition,
  ActionLifecycle,
  ResolveActionContext,
  ResolveActionId,
  ResolveActionResult,
} from "@/lib/actions/types";

type CatalogRow = {
  id: ResolveActionId;
  label: string;
  owner: ProductOwner;
  execution: ActionExecution;
  auth?: boolean;
  risk?: "read" | "write" | "money";
  recovery?: ResolveActionId;
  queries?: readonly string[];
};

const rows: readonly CatalogRow[] = [
  { id: "community.install", label: "Install ecosystem", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/install", method: "POST" }, auth: true, risk: "write", recovery: "profile.manage_connections", queries: ["communities"] },
  { id: "community.open", label: "Open community console", owner: "communities", execution: { kind: "navigation", destination: "/communities/[slug]" }, risk: "read", queries: ["communities", "community-surface"] },
  { id: "community.follow", label: "Follow community", owner: "communities", execution: { kind: "client", handler: "community-follow" }, auth: true, risk: "write", recovery: "community.open" },
  { id: "community.export", label: "Export community record", owner: "communities", execution: { kind: "client", handler: "community-export" }, auth: true, risk: "read", recovery: "community.open" },
  { id: "community.refresh", label: "Refresh community state", owner: "communities", execution: { kind: "client", handler: "community-query-refetch" }, auth: true, risk: "read", recovery: "community.open", queries: ["communities", "community-surface"] },
  { id: "source.connect", label: "Connect evidence source", owner: "profile", execution: { kind: "navigation", destination: "/profile?section=connections" }, auth: true, risk: "write", queries: ["profile-state", "communities"] },
  { id: "source.sync", label: "Synchronize source", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/sensors/run", method: "POST" }, auth: true, risk: "write", recovery: "source.view_status", queries: ["community-surface"] },
  { id: "source.reconnect", label: "Reconnect source", owner: "profile", execution: { kind: "navigation", destination: "/profile?section=connections" }, auth: true, risk: "write", queries: ["profile-state", "communities"] },
  { id: "source.disconnect", label: "Disconnect source", owner: "profile", execution: { kind: "mutation", endpoint: "/api/connectors/[provider]/disconnect", method: "DELETE" }, auth: true, risk: "write", recovery: "source.reconnect", queries: ["profile-state", "communities"] },
  { id: "source.view_status", label: "View source status", owner: "communities", execution: { kind: "navigation", destination: "/communities/[slug]?tab=sources" }, auth: true, risk: "read", queries: ["community-surface"] },
  { id: "identity.claim", label: "Claim identity", owner: "profile", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/identities", method: "POST" }, auth: true, risk: "write", recovery: "identity.submit_proof", queries: ["profile-state", "community-surface"] },
  { id: "identity.inspect", label: "Inspect identity evidence", owner: "communities", execution: { kind: "client", handler: "identity-resolution-drawer" }, auth: true, risk: "read", recovery: "identity.submit_proof", queries: ["community-surface"] },
  { id: "identity.confirm_match", label: "Confirm identity match", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/identities", method: "POST" }, auth: true, risk: "write", recovery: "identity.submit_proof", queries: ["profile-state", "community-surface"] },
  { id: "identity.reject_match", label: "Reject identity match", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/identities", method: "POST" }, auth: true, risk: "write", recovery: "identity.submit_proof", queries: ["profile-state", "community-surface"] },
  { id: "identity.request_creator_confirmation", label: "Request creator confirmation", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/identities", method: "POST" }, auth: true, risk: "write", recovery: "identity.submit_proof", queries: ["profile-state", "community-surface"] },
  { id: "identity.defer", label: "Defer identity review", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/identities", method: "POST" }, auth: true, risk: "write", recovery: "identity.confirm_match", queries: ["community-surface"] },
  { id: "identity.submit_proof", label: "Submit identity proof", owner: "profile", execution: { kind: "navigation", destination: "/profile?section=identity" }, auth: true, risk: "write", queries: ["profile-state"] },
  { id: "identity.set_payout_destination", label: "Set payout destination", owner: "profile", execution: { kind: "navigation", destination: "/profile?section=payouts" }, auth: true, risk: "money", queries: ["profile-state", "capital-state"] },
  { id: "program.create_draft", label: "Create program draft", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/programs", method: "POST" }, auth: true, risk: "write", recovery: "source.connect", queries: ["communities", "community-surface"] },
  { id: "program.update_policy", label: "Update program policy", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/programs/[programId]", method: "PATCH" }, auth: true, risk: "write", recovery: "program.simulate", queries: ["community-surface"] },
  { id: "program.simulate", label: "Simulate program policy", owner: "mission", execution: { kind: "navigation", destination: "/mission?mode=simulate" }, auth: true, risk: "read", recovery: "mission.run_free_analysis", queries: ["mission"] },
  { id: "program.activate", label: "Activate program", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/programs/[programId]", method: "PATCH" }, auth: true, risk: "write", recovery: "program.simulate", queries: ["community-surface", "discover"] },
  { id: "program.pause", label: "Pause program", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/programs/[programId]", method: "PATCH" }, auth: true, risk: "write", recovery: "program.update_policy", queries: ["community-surface", "discover"] },
  { id: "program.resume", label: "Resume program", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/programs/[programId]", method: "PATCH" }, auth: true, risk: "write", recovery: "program.simulate", queries: ["community-surface", "discover"] },
  { id: "program.archive", label: "Archive program", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/programs/[programId]", method: "DELETE" }, auth: true, risk: "write", recovery: "program.create_draft", queries: ["community-surface", "discover"] },
  { id: "program.open_in_discover", label: "Open program in Discover", owner: "discover", execution: { kind: "navigation", destination: "/discover?program=[programId]" }, risk: "read", queries: ["discover"] },
  { id: "program.open_passport", label: "Open public program passport", owner: "communities", execution: { kind: "navigation", destination: "/programs/[programId]" }, risk: "read", queries: ["community-surface", "receipts"] },
  { id: "obligation.review", label: "Review obligation", owner: "communities", execution: { kind: "navigation", destination: "/communities/[slug]?tab=obligations" }, auth: true, risk: "read", queries: ["community-surface"] },
  { id: "obligation.open_evidence", label: "Open obligation evidence", owner: "communities", execution: { kind: "navigation", destination: "/communities/[slug]?tab=obligations&evidence=[id]" }, auth: true, risk: "read", queries: ["community-surface"] },
  { id: "obligation.request_identity", label: "Request payout identity", owner: "communities", execution: { kind: "navigation", destination: "/profile?section=identity" }, auth: true, risk: "write", recovery: "identity.submit_proof", queries: ["profile-state", "community-surface"] },
  { id: "obligation.prepare_settlement", label: "Prepare settlement", owner: "communities", execution: { kind: "mutation", endpoint: "/api/communities/[slug]/settlement-package", method: "POST" }, auth: true, risk: "money", recovery: "identity.set_payout_destination", queries: ["community-surface", "capital-state"] },
  { id: "mission.create", label: "Create Mission", owner: "mission", execution: { kind: "mutation", endpoint: "/api/mission/sessions", method: "POST" }, auth: true, risk: "write", queries: ["mission"] },
  { id: "mission.run_free_analysis", label: "Run free analysis", owner: "mission", execution: { kind: "mutation", endpoint: "/api/mission/sessions/[sessionId]/message", method: "POST" }, risk: "write", queries: ["mission"] },
  { id: "mission.purchase_signal", label: "Purchase protected signal", owner: "mission", execution: { kind: "client", handler: "x402-protected-signal" }, auth: true, risk: "money", recovery: "mission.run_free_analysis", queries: ["mission", "capital-state"] },
  { id: "mission.generate_blueprint", label: "Generate Blueprint", owner: "mission", execution: { kind: "mutation", endpoint: "/api/mission/reports", method: "POST" }, auth: true, risk: "write", recovery: "mission.run_free_analysis", queries: ["mission"] },
  { id: "mission.simulate", label: "Simulate Blueprint", owner: "mission", execution: { kind: "mutation", endpoint: "/api/mission/reports", method: "POST" }, auth: true, risk: "read", recovery: "mission.generate_blueprint", queries: ["mission"] },
  { id: "mission.prepare_authorization", label: "Prepare authorization", owner: "mission", execution: { kind: "mutation", endpoint: "/api/mission/blueprint/authorize", method: "POST" }, auth: true, risk: "money", recovery: "mission.simulate", queries: ["mission", "capital-state"] },
  { id: "capital.open_funding", label: "Open funding requirement", owner: "capital", execution: { kind: "navigation", destination: "/capital?community=[slug]" }, auth: true, risk: "money", queries: ["capital-state"] },
  { id: "capital.submit_funding", label: "Submit funding", owner: "capital", execution: { kind: "mutation", endpoint: "/api/capital/fund", method: "POST" }, auth: true, risk: "money", recovery: "capital.open_funding", queries: ["capital-state", "communities", "discover"] },
  { id: "capital.authorize_settlement", label: "Authorize settlement", owner: "capital", execution: { kind: "mutation", endpoint: "/api/settlement/batch", method: "POST" }, auth: true, risk: "money", recovery: "obligation.prepare_settlement", queries: ["capital-state", "communities", "receipts"] },
  { id: "capital.retry_confirmation", label: "Retry confirmation", owner: "capital", execution: { kind: "mutation", endpoint: "/api/settlement/reconcile", method: "POST" }, auth: true, risk: "money", recovery: "receipt.open_arcscan", queries: ["capital-state", "receipts"] },
  { id: "capital.claim_earning", label: "Claim earning", owner: "capital", execution: { kind: "mutation", endpoint: "/api/rewards/claim", method: "POST" }, auth: true, risk: "money", recovery: "identity.set_payout_destination", queries: ["capital-state", "profile-state"] },
  { id: "receipt.open", label: "Open receipt", owner: "capital", execution: { kind: "navigation", destination: "/receipt/[id]" }, risk: "read", queries: ["receipts"] },
  { id: "receipt.copy_reference", label: "Copy receipt reference", owner: "capital", execution: { kind: "client", handler: "copy-receipt-reference" }, risk: "read", recovery: "receipt.open" },
  { id: "receipt.open_arcscan", label: "Open transaction in ArcScan", owner: "capital", execution: { kind: "navigation", destination: "https://testnet.arcscan.app/tx/[hash]" }, risk: "read", queries: ["receipts"] },
  { id: "profile.manage_connections", label: "Manage connections", owner: "profile", execution: { kind: "navigation", destination: "/profile?section=connections" }, auth: true, risk: "write", queries: ["profile-state", "communities"] },
] as const;

function preconditionsFor(row: CatalogRow) {
  return async (_input: unknown, context: ResolveActionContext) => {
    if (row.auth && !context.userId) {
      return {
        allowed: false,
        reason: "Sign in is required to continue.",
        recoveryActionId: "profile.manage_connections" as ResolveActionId,
      };
    }
    const requiredCapability = `${row.id}:execute`;
    if (context.capabilities && !context.capabilities.has(requiredCapability)) {
      return {
        allowed: false,
        reason: "Your current role cannot perform this operation.",
      };
    }
    return { allowed: true };
  };
}

function defaultRecovery(row: CatalogRow): ResolveActionId {
  if (row.recovery) return row.recovery;
  if (row.owner === "mission") return "mission.run_free_analysis";
  if (row.owner === "capital") return "capital.open_funding";
  if (row.owner === "profile") return "profile.manage_connections";
  if (row.owner === "discover") return "program.open_in_discover";
  return "community.open";
}

function interpolate(template: string, input: unknown): string {
  const values = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return template.replace(/\[([A-Za-z0-9_]+)\]/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing action input: ${key}`);
    }
    return encodeURIComponent(String(value));
  });
}

function executorFor(row: CatalogRow) {
  return async (input: unknown, context: ResolveActionContext) => {
    const precondition = await preconditionsFor(row)(input, context);
    if (!precondition.allowed) {
      return {
        state: "rejected" as const,
        userMessage: precondition.reason ?? "This operation is currently blocked.",
        retryable: true,
        nextActionId: precondition.recoveryActionId ?? defaultRecovery(row),
      };
    }

    if (row.execution.kind === "navigation") {
      return {
        state: "confirmed" as const,
        data: { destination: interpolate(row.execution.destination, input) },
        userMessage: "Destination is ready.",
        retryable: false,
      };
    }

    if (row.execution.kind === "client") {
      return {
        state: "rejected" as const,
        userMessage: "This operation must be completed in its active product panel.",
        technicalDetails: `client_handler:${row.execution.handler}`,
        retryable: true,
        nextActionId: defaultRecovery(row),
      };
    }

    const endpoint = interpolate(row.execution.endpoint, input);
    try {
      const response = await fetch(endpoint, {
        method: row.execution.method,
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-correlation-id": context.correlationId,
          "idempotency-key": context.idempotencyKey,
        },
        body: row.execution.method === "DELETE" ? undefined : JSON.stringify(input ?? {}),
      });
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        return {
          state: "rejected" as const,
          data: body,
          userMessage: typeof body.error === "string" ? body.error : "The operation was rejected.",
          retryable: response.status >= 500 || response.status === 429,
          nextActionId: defaultRecovery(row),
        };
      }
      return {
        state: "pending_external" as const,
        data: body,
        userMessage: "Submitted. Awaiting authoritative confirmation.",
        retryable: true,
        nextActionId: row.risk === "money" ? "capital.retry_confirmation" as ResolveActionId : undefined,
      };
    } catch (error) {
      return {
        state: "sync_failed" as const,
        userMessage: "The operation could not synchronize. Your prior confirmed state is unchanged.",
        technicalDetails: error instanceof Error ? error.message : String(error),
        retryable: true,
        nextActionId: defaultRecovery(row),
      };
    }
  };
}

export const actionRegistry = Object.fromEntries(
  rows.map((row) => [
    row.id,
    {
      id: row.id,
      label: row.label,
      owner: row.owner,
      inputSchema: z.record(z.string(), z.unknown()).or(z.undefined()),
      roles: ["user", "operator", "funder", "creator"],
      execution: row.execution,
      requiresAuth: row.auth ?? false,
      risk: row.risk ?? "read",
      recoveryActionId: defaultRecovery(row),
      affectedQueryKeys: row.queries ?? [],
      auditEvent: `action.${row.id}`,
      getPreconditions: preconditionsFor(row),
      getOptimisticPatch: () => null,
      execute: executorFor(row),
    } satisfies ActionDefinition,
  ]),
) as unknown as Record<ResolveActionId, ActionDefinition>;

export function isRegisteredActionId(value: string): value is ResolveActionId {
  return Object.prototype.hasOwnProperty.call(actionRegistry, value);
}

export function getActionDefinition(id: ResolveActionId): ActionDefinition {
  return actionRegistry[id];
}

if (Object.keys(actionRegistry).length !== RESOLVE_ACTION_IDS.length) {
  throw new Error("Action registry and action ID catalog are out of sync.");
}
