import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ERC-8183's complete() always pays the job's fixed provider wallet - there
 * is no on-chain call to reassign `provider`, and the real contributor is
 * only known once the Request is taken, after the job already exists. This
 * covers the follow-on transfer that forwards the released payment from
 * that fixed wallet to the contributor's actual verified payout address,
 * and the invariant that must hold above all else: never send it twice.
 */

const { transferUsdcPayout, verifyArcTx } = vi.hoisted(() => ({
  transferUsdcPayout: vi.fn(),
  verifyArcTx: vi.fn(),
}));

vi.mock("@/lib/settlement/circle-client", () => ({ transferUsdcPayout }));
vi.mock("@/lib/settlement/arc-verify", () => ({ verifyArcTx }));
vi.mock("@/lib/db/ensure-request-payout-schema", () => ({
  ensureRequestPayoutSchema: vi.fn().mockResolvedValue(true),
}));

type Row = {
  id: string;
  opportunityId: string;
  settlementBatchId: string;
  fromAddress: string;
  toAddress: string;
  amountUsdcMicro: bigint;
  status: string;
  txHash: string | null;
  idempotencyKey: string;
  error: string | null;
};

let store: Map<string, Row>;
let nextId: number;

vi.mock("@/lib/db", () => ({
  prisma: {
    requestContributorPayout: {
      findUnique: vi.fn(({ where }: { where: { opportunityId: string } }) => {
        return Promise.resolve(store.get(where.opportunityId) ?? null);
      }),
      create: vi.fn(({ data }: { data: Omit<Row, "id"> }) => {
        if (store.has(data.opportunityId)) {
          throw new Error("Unique constraint failed on the fields: (`opportunityId`)");
        }
        const row: Row = { id: `payout-${nextId++}`, ...data, txHash: null, error: null };
        store.set(data.opportunityId, row);
        return Promise.resolve(row);
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const existing = [...store.values()].find((r) => r.id === where.id)!;
        const updated = { ...existing, ...data };
        store.set(existing.opportunityId, updated);
        return Promise.resolve(updated);
      }),
    },
  },
}));

describe("releaseContributorPayout", () => {
  beforeEach(() => {
    store = new Map();
    nextId = 1;
    transferUsdcPayout.mockReset();
    verifyArcTx.mockReset().mockResolvedValue({ found: true, success: true });
  });

  const input = {
    opportunityId: "opp-1",
    settlementBatchId: "batch-1",
    fromAddress: "0xprovider",
    toAddress: "0xcontributor",
    amountUsdcMicro: 1_000_000n,
  };

  it("sends the transfer once and confirms it", async () => {
    transferUsdcPayout.mockResolvedValue("0xtxhash1");
    const { releaseContributorPayout } = await import("@/lib/settlement/contributor-payout");

    const result = await releaseContributorPayout(input);

    expect(result).toEqual({ status: "confirmed", txHash: "0xtxhash1", payoutId: "payout-1" });
    expect(transferUsdcPayout).toHaveBeenCalledTimes(1);
    expect(transferUsdcPayout).toHaveBeenCalledWith({
      fromWalletAddress: "0xprovider",
      toAddress: "0xcontributor",
      amountTokenUnits: "1000000",
      idempotencyKey: "request-payout:opp-1",
    });
  });

  it("never re-sends once a payout has confirmed, even if called again", async () => {
    transferUsdcPayout.mockResolvedValue("0xtxhash1");
    const { releaseContributorPayout } = await import("@/lib/settlement/contributor-payout");

    await releaseContributorPayout(input);
    const second = await releaseContributorPayout(input);

    expect(second).toEqual({ status: "confirmed", txHash: "0xtxhash1", payoutId: "payout-1" });
    expect(transferUsdcPayout).toHaveBeenCalledTimes(1);
  });

  it("leaves a retryable failed row when the transfer fails, without claiming payment", async () => {
    transferUsdcPayout.mockRejectedValueOnce(new Error("Circle transaction denied"));
    const { releaseContributorPayout } = await import("@/lib/settlement/contributor-payout");

    const result = await releaseContributorPayout(input);
    expect(result).toEqual({ status: "failed", error: "Circle transaction denied", payoutId: "payout-1" });
    expect(store.get("opp-1")?.status).toBe("failed");

    transferUsdcPayout.mockResolvedValueOnce("0xtxhash-retry");
    const retry = await releaseContributorPayout(input);
    expect(retry).toEqual({ status: "confirmed", txHash: "0xtxhash-retry", payoutId: "payout-1" });
    expect(transferUsdcPayout).toHaveBeenCalledTimes(2);
  });

  it("resolves a concurrent create race to the single row instead of throwing", async () => {
    // Simulate two requests racing to create the same opportunity's payout
    // row: the first insert wins, the second must observe it rather than
    // erroring the whole release.
    store.set("opp-1", {
      id: "payout-1",
      opportunityId: "opp-1",
      settlementBatchId: "batch-1",
      fromAddress: "0xprovider",
      toAddress: "0xcontributor",
      amountUsdcMicro: 1_000_000n,
      status: "pending",
      txHash: null,
      idempotencyKey: "request-payout:opp-1",
      error: null,
    });
    const { create } = (await import("@/lib/db")).prisma.requestContributorPayout;
    (create as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("Unique constraint failed on the fields: (`opportunityId`)");
    });
    transferUsdcPayout.mockResolvedValue("0xtxhash-race");

    const { releaseContributorPayout } = await import("@/lib/settlement/contributor-payout");
    const result = await releaseContributorPayout(input);

    expect(result).toEqual({ status: "confirmed", txHash: "0xtxhash-race", payoutId: "payout-1" });
  });
});
