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
};

export type WalletSnapshot = {
  spendableUsd: number;
  totalUsdc: string;
  loaded: boolean;
  address?: string;
  shortAddress?: string;
  explorerUrl?: string | null;
};

export async function apiInstallCommunity(slug: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(`/api/communities/${slug}/install?minimal=1`, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
    });
    const data = await parseJsonResponse<{ error?: string; alreadyInstalled?: boolean }>(res);
    if (!res.ok) throw new Error(data.error ?? "Install failed");
    return data;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Attach timed out — try again or attach from Communities`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiCreateProgram(slug: string, templateId?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(`/api/communities/${slug}/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ templateId }),
      signal: controller.signal,
    });
    const data = await parseJsonResponse<{ error?: string; program?: ProgramRecord }>(
      res,
    );
    if (!res.ok) throw new Error(data.error ?? "Could not create program");
    return data as { program?: ProgramRecord };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Creating the program is still syncing. Open Communities or retry in a moment.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFundProgram(programId: string, amountUsd: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch("/api/capital/fund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ programId, amountUsd }),
      signal: controller.signal,
    });
    const data = await parseJsonResponse<{ error?: string }>(res);
    if (!res.ok) throw new Error(data.error ?? "Fund failed");
    return data;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Funding is still syncing. Open Capital status or retry in a moment.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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

  const res = await fetch(`/api/discover/fund-target?${params}`, { credentials: "include" });
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
    label: action.label,
  };
}

export async function apiDiscoverAction(
  action: DiscoverAction,
  opts?: { amountUsd?: number; role?: string; surface?: string },
): Promise<DiscoverActionResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch("/api/discover/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: controller.signal,
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
        role: opts?.role,
        surface: opts?.surface,
      }),
    });
    return await parseJsonResponse<DiscoverActionResponse>(res);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        ok: false,
        code: "TIMEOUT",
        message:
          "The action is still syncing. Open the community console or Capital status to continue.",
        nextAction: "retry",
      };
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
