import { mutationFetch } from "@/lib/api/mutation-fetch";
import { ACTION_STATUS } from "@/lib/copy/action-status";
import { FundRequestInFlightError } from "@/lib/capital/poll-fund-finalize";
import type { DiscoverAction } from "@/lib/discover/types";
import { parseJsonResponse } from "@/lib/http/parse-json-response";
import type { DiscoverActionResponse } from "@/lib/discover/discover-action-response";
import type { ProgramRecord } from "@/lib/communities/types";

export type FundSheetRequest = {
  programId?: string;
  communitySlug?: string;
  templateId?: string;
  missionId?: string;
  amountUsd?: number;
  label?: string;
  whyFund?: string;
  whoBenefits?: string;
  programName?: string;
};

export type WalletSnapshot = {
  spendableUsd: number;
  appSpendableUsd?: number;
  externalSpendableUsd?: number;
  totalUsdc: string;
  loaded: boolean;
  address?: string;
  shortAddress?: string;
  explorerUrl?: string | null;
  fundingSource?: "app" | "external" | null;
};

function acceptedBackgroundError() {
  return new Error(ACTION_STATUS.acceptedBackground);
}

export async function apiInstallCommunity(slug: string) {
  try {
    const res = await mutationFetch(`/api/communities/${slug}/install?minimal=1`, {
      method: "POST",
    });
    const data = await parseJsonResponse<{ error?: string; alreadyInstalled?: boolean }>(res);
    if (!res.ok) throw new Error(data.error ?? "Install failed");
    return data;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw acceptedBackgroundError();
    throw e;
  }
}

export async function apiCreateProgram(slug: string, templateId?: string) {
  try {
    const res = await mutationFetch(`/api/communities/${slug}/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    const data = await parseJsonResponse<{ error?: string; program?: ProgramRecord }>(res);
    if (!res.ok) throw new Error(data.error ?? "Could not create program");
    return data as { program?: ProgramRecord };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw acceptedBackgroundError();
    throw e;
  }
}

export async function apiDeployProgramOnArc(slug: string, programId: string) {
  try {
    const res = await mutationFetch(`/api/communities/${slug}/programs/${programId}/deploy`, {
      method: "POST",
    });
    const data = await parseJsonResponse<{
      ok?: boolean;
      error?: string;
      message?: string;
      settlementId?: string;
      settledUsd?: number;
      explorerUrls?: string[];
    }>(res);
    if (!res.ok) throw new Error(data.error ?? data.message ?? "Arc settlement failed");
    return data;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw acceptedBackgroundError();
    throw e;
  }
}

export async function apiFundProgram(programId: string, amountUsd: number) {
  try {
    const res = await mutationFetch("/api/capital/fund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programId, amountUsd }),
    });
    const data = await parseJsonResponse<{
      error?: string;
      activityId?: string;
      programId?: string;
      message?: string;
      txHash?: string;
      status?: "completed" | "pending_arc";
    }>(res);
    if (!res.ok) throw new Error(data.error ?? "Fund failed");
    return data;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new FundRequestInFlightError();
    }
    throw e;
  }
}

export async function apiSyncConnectedWallet(walletAddress: string) {
  const res = await mutationFetch("/api/wallet/sync-connected", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  const data = await parseJsonResponse<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Wallet sync failed");
  return data;
}

export type FundTargetPayload = {
  programId: string | null;
  programName: string | null;
  communitySlug: string;
  templateId: string;
  needsInstall: boolean;
  needsCreate: boolean;
  missionId: string | null;
};

export async function apiResolveFundTarget(input: {
  programId?: string;
  communitySlug?: string;
  templateId?: string;
  missionId?: string;
}): Promise<FundTargetPayload> {
  const params = new URLSearchParams();
  if (input.programId) params.set("programId", input.programId);
  if (input.communitySlug) params.set("communitySlug", input.communitySlug);
  if (input.templateId) params.set("templateId", input.templateId);
  if (input.missionId) params.set("missionId", input.missionId);

  const res = await mutationFetch(`/api/discover/fund-target?${params}`);
  const data = await parseJsonResponse<{ error?: string; target?: FundTargetPayload }>(res);
  if (!res.ok) throw new Error(data.error ?? "Could not resolve program");
  return data.target as FundTargetPayload;
}

export async function apiFetchWallet(): Promise<WalletSnapshot> {
  const res = await fetch("/api/capital/state", { credentials: "include" });
  if (!res.ok) {
    return { spendableUsd: 0, totalUsdc: "0", loaded: true };
  }
  const data = await parseJsonResponse<{
    walletAddress?: string;
    shortWalletAddress?: string;
    spendableBalance?: number | null;
    usdcBalance?: number | null;
    arcNetwork?: { explorerUrl?: string };
    balance?: { spendableUsd?: string; totalUsdc?: string };
  }>(res);
  const spendable = Number(
    data.spendableBalance ?? data.balance?.spendableUsd ?? data.balance?.totalUsdc ?? 0,
  );
  const total = data.usdcBalance ?? data.balance?.totalUsdc ?? "0";
  const address = data.walletAddress;
  const explorerUrl =
    address && address.match(/^0x[a-fA-F0-9]{40}$/i)
      ? `${data.arcNetwork?.explorerUrl ?? process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app"}/address/${address}`
      : null;
  return {
    spendableUsd: Number.isFinite(spendable) ? spendable : 0,
    totalUsdc: String(total),
    loaded: true,
    address,
    shortAddress: data.shortWalletAddress,
    explorerUrl,
  };
}

export async function apiVerifyAndShareReceipt(href: string, origin: string) {
  const match = href.match(/\/(?:ledger|receipt)\/([^/?#]+)/);
  const id = match?.[1];
  if (!id) throw new Error("Invalid receipt link");

  const res = await fetch(`/api/receipt/${id}`);
  if (!res.ok) throw new Error("Receipt not found — authorization may still be pending");

  const url = `${origin}/receipt/${id}`;
  await navigator.clipboard.writeText(url);
  return url;
}

export function fundParamsFromAction(action: DiscoverAction): FundSheetRequest {
  return {
    programId: action.programId,
    communitySlug: action.communitySlug,
    templateId: action.templateId,
    missionId: action.missionId,
    amountUsd: action.amountUsd,
    label: action.programName ?? action.label,
    whyFund: action.whyFund,
    whoBenefits: action.whoBenefits,
    programName: action.programName,
  };
}

export async function apiDiscoverAction(
  action: DiscoverAction,
  opts?: { amountUsd?: number; role?: string; surface?: string },
): Promise<DiscoverActionResponse> {
  try {
    const res = await mutationFetch("/api/discover/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionKind: action.kind,
        actionId: action.id,
        label: action.label,
        communitySlug: action.communitySlug,
        programId: action.programId,
        templateId: action.templateId,
        missionId: action.missionId,
        amountUsd: opts?.amountUsd ?? action.amountUsd,
        entityId: action.entityPath,
        href: action.href,
        automationTrigger: action.automationTrigger,
        role: opts?.role,
        surface: opts?.surface,
      }),
    });
    return await parseJsonResponse<DiscoverActionResponse>(res);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        ok: true,
        action: "accepted",
        status: "accepted",
        message: ACTION_STATUS.acceptedBackground,
      };
    }
    throw e;
  }
}

export function isAcceptedBackgroundError(e: unknown): boolean {
  return e instanceof Error && e.message === ACTION_STATUS.acceptedBackground;
}
