import { installCommunity } from "@/lib/communities/installs";
import { createProgram } from "@/lib/communities/programs";
import { fundCommunityProgram } from "@/lib/capital/fund-program";
import { resolveFundTarget } from "@/lib/discover/fund-target";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";
import { syncUserJellyfinSensors } from "@/lib/connectors/user-jellyfin-sync";
import { refreshOssOpportunityStore } from "@/lib/github/oss-scan-store";
import { getRealSpendableUsd } from "@/lib/wallet/sync-identity-balance";
import { buildPublicReceipt } from "@/lib/ledger/receipt";
import type { DiscoverActionKind } from "@/lib/discover/types";
import {
  discoverActionError,
  type DiscoverActionResponse,
} from "@/lib/discover/discover-action-response";

export type DiscoverActionRequest = {
  actionKind: DiscoverActionKind;
  actionId?: string;
  label?: string;
  communitySlug?: string;
  programId?: string;
  templateId?: string;
  missionId?: string;
  amountUsd?: number;
  entityId?: string;
  href?: string;
  role?: string;
  surface?: string;
};

async function auditDiscoverAction(
  userId: string,
  input: DiscoverActionRequest,
  result: DiscoverActionResponse,
) {
  await recordTimelineEvent({
    userId,
    eventType: `discover.${input.actionKind}`,
    title: input.label ?? input.actionKind,
    detail: result.message,
    severity: result.ok ? "success" : "warning",
    metadata: {
      actionId: input.actionId,
      actionKind: input.actionKind,
      communitySlug: input.communitySlug,
      programId: input.programId,
      templateId: input.templateId,
      amountUsd: input.amountUsd,
      role: input.role,
      surface: input.surface,
      entityId: input.entityId,
      status: result.ok ? result.status : result.code,
      txHash: result.ok ? result.txHash : undefined,
      proofId: result.ok ? result.proofId : undefined,
      receiptUrl: result.ok ? result.receiptUrl : undefined,
    },
  }).catch((e) => console.error("[discover/audit]", e));
}

async function ensureProgramId(
  userId: string,
  target: NonNullable<Awaited<ReturnType<typeof resolveFundTarget>>>,
): Promise<string> {
  if (target.programId) return target.programId;

  if (target.needsInstall) {
    const installed = await installCommunity(userId, target.communitySlug);
    if (!installed.ok && !installed.alreadyInstalled) {
      throw new Error(installed.error ?? "Could not create community program");
    }
  }

  const created = await createProgram(userId, target.communitySlug, {
    templateId: target.templateId,
    name: target.programName ?? undefined,
  });
  if (!created.ok || !created.program?.id) {
    throw new Error(created.error ?? "Program rule required");
  }
  return created.program.id;
}

/** Server-side Discover action execution with audit trail. */
export async function executeDiscoverAction(
  userId: string,
  input: DiscoverActionRequest,
): Promise<DiscoverActionResponse> {
  const kind = input.actionKind;

  try {
    let response: DiscoverActionResponse;

    switch (kind) {
      case "fund":
      case "sponsor": {
        const amountUsd = input.amountUsd ?? 0;
        if (amountUsd < 5) {
          response = discoverActionError(
            "AMOUNT_TOO_LOW",
            "Amount can't be less than $5",
            "fund_pool",
          );
          break;
        }

        const balance = await getRealSpendableUsd(userId, { sync: true });
        if (balance.availableUsd < amountUsd) {
          response = discoverActionError(
            "WALLET_BALANCE_LOW",
            "Add Arc USDC before funding this pool.",
            "add_funds",
          );
          break;
        }

        let programId = input.programId;
        if (!programId) {
          const target = await resolveFundTarget({
            programId: input.programId,
            communitySlug: input.communitySlug,
            templateId: input.templateId,
            missionId: input.missionId,
            userId,
          });
          if (!target) {
            response = discoverActionError(
              "PROGRAM_NOT_FOUND",
              "Program rule required",
              "create_rule",
            );
            break;
          }
          programId = await ensureProgramId(userId, target);
        }

        const funded = await fundCommunityProgram({ userId, programId, amountUsd });
        if (!funded.ok) {
          response = discoverActionError(
            "FUND_FAILED",
            funded.error,
            funded.error.toLowerCase().includes("balance") ? "add_funds" : undefined,
          );
          break;
        }

        response = {
          ok: true,
          action: "fund_pool",
          entityId: programId,
          status: "funded",
          amountUsd,
          nextState: "funded",
          message: `$${amountUsd.toFixed(2)} added to pool`,
        };
        break;
      }

      case "install": {
        if (!input.communitySlug) {
          response = discoverActionError("MISSING_SLUG", "Community required");
          break;
        }
        const result = await installCommunity(userId, input.communitySlug);
        if (!result.ok && !result.alreadyInstalled) {
          response = discoverActionError("INSTALL_FAILED", result.error ?? "Install failed");
          break;
        }
        response = {
          ok: true,
          action: "create_community_program",
          entityId: input.communitySlug,
          status: result.alreadyInstalled ? "ready" : "installed",
          nextState: "detected",
          message: result.alreadyInstalled
            ? "Community program already active"
            : "Community program created",
        };
        break;
      }

      case "create_program": {
        if (!input.communitySlug) {
          response = discoverActionError("MISSING_SLUG", "Community required");
          break;
        }
        const installed = await installCommunity(userId, input.communitySlug);
        if (!installed.ok && !installed.alreadyInstalled) {
          response = discoverActionError("INSTALL_FAILED", installed.error ?? "Install failed");
          break;
        }

        const created = await createProgram(userId, input.communitySlug, {
          templateId: input.templateId as import("@/lib/communities/catalog").ProgramTemplateId,
          name: input.label,
        });
        if (!created.ok || !created.program) {
          response = discoverActionError(
            "CREATE_RULE_FAILED",
            created.error ?? "Could not create payout rule",
          );
          break;
        }

        response = {
          ok: true,
          action: "create_rule",
          entityId: created.program.id,
          status: "rule_active",
          nextState: "programmed",
          message: `Payout rule created: ${created.program.name}`,
        };
        break;
      }

      case "analyze": {
        const slug = input.communitySlug ?? "";
        if (slug === "jellyfin") {
          const sync = await syncUserJellyfinSensors(userId);
          if (!sync.ok && sync.reason === "jellyfin_not_connected") {
            response = discoverActionError(
              "SOURCE_NOT_CONNECTED",
              "Connect Jellyfin in Profile first",
              "connect_source",
            );
            break;
          }
          if ("reason" in sync && sync.reason === "browser_sync") {
            response = {
              ok: true,
              action: "scan_source",
              entityId: slug,
              status: "browser_sync",
              nextState: "verified",
              message: "Reading activity from your Jellyfin session in this browser",
            };
            break;
          }
          response = {
            ok: true,
            action: "scan_source",
            entityId: slug,
            status: "scanned",
            nextState: "verified",
            message: `Imported ${sync.ingested ?? 0} watch events`,
          };
          break;
        }

        if (slug === "react" || slug === "linux" || !slug) {
          const scan = await refreshOssOpportunityStore().catch(() => ({
            count: 0,
            scannedAt: new Date().toISOString(),
          }));
          response = {
            ok: true,
            action: "scan_source",
            entityId: slug || "oss",
            status: "scanned",
            nextState: "verified",
            message: `Scanned ${scan.count} GitHub repositories`,
          };
          break;
        }

        response = {
          ok: true,
          action: "scan_source",
          entityId: slug,
          status: "pending",
          nextState: "verified",
          message: "Reading activity — proof updates when the connector syncs",
        };
        break;
      }

      case "connect_sensor": {
        response = {
          ok: true,
          action: "connect_source",
          entityId: input.communitySlug,
          status: "redirect",
          message: "Connect proof source in Profile — syncs everywhere",
        };
        break;
      }

      case "claim": {
        response = {
          ok: true,
          action: "claim_value",
          entityId: input.entityId ?? input.programId,
          status: "redirect",
          message: "Open claim flow with verified identity",
        };
        break;
      }

      case "share":
      case "open": {
        const proofId =
          input.href?.match(/\/(?:ledger|receipt)\/([^/?#]+)/)?.[1] ??
          input.entityId;
        if (proofId) {
          const receipt = await buildPublicReceipt(proofId);
          if (!receipt) {
            response = discoverActionError(
              "PROOF_NOT_FOUND",
              "Proof not found — settlement may still be pending",
            );
            break;
          }
          response = {
            ok: true,
            action: kind === "share" ? "view_receipt" : "view_proof",
            entityId: proofId,
            proofId,
            status: "verified",
            receiptUrl: `/receipt/${proofId}`,
            nextState: "settled",
            message: receipt.contextLabel ?? "Proof verified",
          };
          break;
        }
        response = {
          ok: true,
          action: "open_entity",
          entityId: input.entityId ?? input.communitySlug,
          status: "redirect",
        };
        break;
      }

      default:
        response = discoverActionError(
          "UNSUPPORTED_ACTION",
          `Action "${kind}" is not available on Discover`,
        );
    }

    await auditDiscoverAction(userId, input, response);
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Action failed";
    const failure = discoverActionError("ACTION_FAILED", message);
    await auditDiscoverAction(userId, input, failure);
    return failure;
  }
}
