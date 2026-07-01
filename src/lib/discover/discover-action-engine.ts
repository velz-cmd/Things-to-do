import type { DiscoverAction } from "@/lib/discover/types";
import { parseJsonResponse } from "@/lib/http/parse-json-response";

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
  const res = await fetch(`/api/communities/${slug}/install`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJsonResponse<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Install failed");
  return data as { alreadyInstalled?: boolean };
}

export async function apiCreateProgram(slug: string, templateId?: string) {
  const res = await fetch(`/api/communities/${slug}/programs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ templateId }),
  });
  const data = await parseJsonResponse<{ error?: string; program?: { id: string; name: string } }>(
    res,
  );
  if (!res.ok) throw new Error(data.error ?? "Could not create program");
  return data as { program?: { id: string; name: string } };
}

export async function apiFundProgram(programId: string, amountUsd: number) {
  const res = await fetch("/api/capital/fund", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ programId, amountUsd }),
  });
  const data = await parseJsonResponse<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Fund failed");
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

  const res = await fetch(`/api/discover/fund-target?${params}`, { credentials: "include" });
  const data = await parseJsonResponse<{ error?: string; target?: FundTargetPayload }>(res);
  if (!res.ok) throw new Error(data.error ?? "Could not resolve program");
  return data.target as FundTargetPayload;
}

export async function apiFetchWallet(): Promise<WalletSnapshot> {
  const res = await fetch("/api/capital/wallet", { credentials: "include" });
  if (!res.ok) {
    return { spendableUsd: 0, totalUsdc: "0", loaded: true };
  }
  const data = await parseJsonResponse<{
    wallet?: { address?: string; shortAddress?: string };
    balance?: { spendableUsd?: string; totalUsdc?: string };
  }>(res);
  const spendable = Number(
    data.balance?.spendableUsd ?? data.balance?.totalUsdc ?? 0,
  );
  const address = data.wallet?.address;
  const explorerUrl =
    address && address.match(/^0x[a-fA-F0-9]{40}$/i)
      ? `${process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app"}/address/${address}`
      : null;
  return {
    spendableUsd: Number.isFinite(spendable) ? spendable : 0,
    totalUsdc: String(data.balance?.totalUsdc ?? "0"),
    loaded: true,
    address,
    shortAddress: data.wallet?.shortAddress,
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
