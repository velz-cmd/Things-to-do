import type { MissionReportRecord } from "@/lib/mission/mission-report-store";
import type { MissionBlueprintPackage } from "@/lib/mission/mission-blueprint-package";
import type { BlueprintSettlementPreview } from "@/lib/mission/mission-blueprint-settlement";
import type { StoredMissionReceipt } from "@/lib/mission/server/mission-blueprint-receipts";

export async function persistMissionReportServer(input: {
  record: MissionReportRecord;
  fundTxHash?: string;
  programId?: string | null;
}): Promise<StoredMissionReceipt | null> {
  try {
    const res = await fetch("/api/mission/reports", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        package: input.record,
        status: input.record.status,
        fundTxLabel: input.record.fundTxLabel,
        fundTxHash: input.fundTxHash,
        programId: input.programId ?? input.record.programId,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { receipt?: StoredMissionReceipt };
    return data.receipt ?? null;
  } catch {
    return null;
  }
}

export async function fetchMissionReportServer(
  id: string,
): Promise<StoredMissionReceipt | null> {
  try {
    const res = await fetch(`/api/mission/reports/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { receipt?: StoredMissionReceipt };
    return data.receipt ?? null;
  } catch {
    return null;
  }
}

export async function prepareBlueprintSettlement(
  pkg: MissionBlueprintPackage,
): Promise<BlueprintSettlementPreview | null> {
  try {
    const res = await fetch("/api/mission/blueprint/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: pkg }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { preview?: BlueprintSettlementPreview };
    return data.preview ?? null;
  } catch {
    return null;
  }
}

export async function authorizeBlueprintServer(input: {
  pkg: MissionBlueprintPackage;
  amountUsd?: number;
  skipFund?: boolean;
}): Promise<{
  ok: boolean;
  receipt?: StoredMissionReceipt;
  preview?: BlueprintSettlementPreview;
  fundTxHash?: string;
  fundTxLabel?: string;
  fundingIntentId?: string;
  capitalHref?: string;
  error?: string;
}> {
  try {
    const res = await fetch("/api/mission/blueprint/authorize", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `mission:${input.pkg.id}:authorization`,
      },
      body: JSON.stringify({
        package: input.pkg,
        amountUsd: input.amountUsd,
        skipFund: input.skipFund,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      receipt?: StoredMissionReceipt;
      preview?: BlueprintSettlementPreview;
      fundTxHash?: string;
      fundTxLabel?: string;
      fundingIntentId?: string;
      capitalHref?: string;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error, preview: data.preview, capitalHref: data.capitalHref };
    }
    return {
      ok: true,
      receipt: data.receipt,
      preview: data.preview,
      fundTxHash: data.fundTxHash,
      fundTxLabel: data.fundTxLabel,
      fundingIntentId: data.fundingIntentId,
      capitalHref: data.capitalHref,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Authorize failed" };
  }
}

export async function fetchMissionMemory(slug: string): Promise<{
  line: string | null;
  receiptId: string | null;
}> {
  try {
    const res = await fetch(
      `/api/mission/reports/memory?slug=${encodeURIComponent(slug)}`,
      { credentials: "include", cache: "no-store" },
    );
    if (!res.ok) return { line: null, receiptId: null };
    const data = (await res.json()) as {
      memory?: { line?: string; receipt?: { id: string } };
    };
    return {
      line: data.memory?.line ?? null,
      receiptId: data.memory?.receipt?.id ?? null,
    };
  } catch {
    return { line: null, receiptId: null };
  }
}
