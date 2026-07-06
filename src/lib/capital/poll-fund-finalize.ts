import { mutationFetch } from "@/lib/api/mutation-fetch";
import { parseJsonResponse } from "@/lib/http/parse-json-response";

export type FundFinalizeResponse =
  | { ok: true; status: "completed"; activityId: string; txHash?: string }
  | { ok: true; status: "pending_arc"; activityId: string; message: string }
  | { ok: true; status: "reversed"; activityId: string; message: string }
  | { ok: true; resolved: number }
  | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function apiFinalizePendingFunds(activityId?: string): Promise<FundFinalizeResponse> {
  const res = await mutationFetch("/api/capital/fund/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(activityId ? { activityId } : {}),
  });
  return parseJsonResponse<FundFinalizeResponse>(res);
}

/** After a slow fund request, poll until Arc confirms, reverses, or times out. */
export async function pollFundUntilSettled(
  activityId?: string,
  opts?: { attempts?: number; intervalMs?: number },
): Promise<FundFinalizeResponse | null> {
  const attempts = opts?.attempts ?? 12;
  const intervalMs = opts?.intervalMs ?? 3_000;

  for (let i = 0; i < attempts; i++) {
    const result = await apiFinalizePendingFunds(activityId).catch(() => null);
    if (!result) {
      await sleep(intervalMs);
      continue;
    }
    if ("status" in result && result.status === "completed") return result;
    if ("status" in result && result.status === "reversed") return result;
    if ("resolved" in result && result.resolved > 0) {
      return { ok: true, status: "completed", activityId: activityId ?? "batch" };
    }
    await sleep(intervalMs);
  }
  return null;
}

export class FundRequestInFlightError extends Error {
  readonly activityId?: string;

  constructor(activityId?: string) {
    super("Fund request is still processing on the server");
    this.name = "FundRequestInFlightError";
    this.activityId = activityId;
  }
}
