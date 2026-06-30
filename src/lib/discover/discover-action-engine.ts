import type { DiscoverAction } from "@/lib/discover/types";

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
};

export async function apiInstallCommunity(slug: string) {
  const res = await fetch(`/api/communities/${slug}/install`, {
    method: "POST",
    credentials: "include",
  });
  const data = await res.json();
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
  const data = await res.json();
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
  const data = await res.json();
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not resolve program");
  return data.target as FundTargetPayload;
}

export async function apiFetchWallet(): Promise<WalletSnapshot> {
  const res = await fetch("/api/capital/wallet", { credentials: "include" });
  if (!res.ok) {
    return { spendableUsd: 0, totalUsdc: "0", loaded: true };
  }
  const data = await res.json();
  const spendable = Number(
    data.balance?.spendableUsd ?? data.balance?.totalUsdc ?? 0,
  );
  return {
    spendableUsd: Number.isFinite(spendable) ? spendable : 0,
    totalUsdc: String(data.balance?.totalUsdc ?? "0"),
    loaded: true,
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
