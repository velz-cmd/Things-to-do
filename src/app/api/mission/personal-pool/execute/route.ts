import { NextResponse } from "next/server";
import { z } from "zod";
import { isAddress } from "viem";
import { requireReadyUser } from "@/lib/auth/session";
import { sendUsdcFromUserCircleWallet } from "@/lib/wallet/circle-arc-transfer";
import { explorerTxUrl } from "@/lib/settlement/arc-config";

const bodySchema = z.object({
  poolName: z.string().min(1).max(120),
  payees: z
    .array(
      z.object({
        label: z.string().min(1),
        amountUsd: z.number().positive(),
        address: z.string().optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const maxDuration = 120;

function resolvePayeeAddress(label: string, explicit?: string): `0x${string}` | null {
  const candidate = (explicit ?? label).trim();
  if (isAddress(candidate)) return candidate;
  const match = candidate.match(/(0x[a-fA-F0-9]{40})/);
  return match && isAddress(match[1]!) ? (match[1] as `0x${string}`) : null;
}

/** Execute a personal-pool Arc batch — direct USDC to payee wallets (not Discover communal). */
export async function POST(req: Request) {
  try {
    const ready = await requireReadyUser();
    if ("error" in ready) {
      return NextResponse.json({ error: ready.error }, { status: ready.status });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid batch payload" }, { status: 400 });
    }

    const transfers: Array<{ label: string; amountUsd: number; txHash: string; explorerUrl: string }> = [];
    const skipped: string[] = [];

    for (const payee of parsed.data.payees) {
      const dest = resolvePayeeAddress(payee.label, payee.address);
      if (!dest) {
        skipped.push(payee.label);
        continue;
      }
      const { txHash } = await sendUsdcFromUserCircleWallet({
        user: ready.profile,
        destinationAddress: dest,
        amountUsd: payee.amountUsd,
        idempotencyKey: `personal-pool:${parsed.data.poolName}:${payee.label}:${payee.amountUsd}`,
      });
      transfers.push({
        label: payee.label,
        amountUsd: payee.amountUsd,
        txHash,
        explorerUrl: explorerTxUrl(txHash),
      });
    }

    if (!transfers.length) {
      return NextResponse.json(
        {
          error:
            "No payee had a valid Arc wallet address — use 0x… in the payee row or label",
          skipped,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      poolName: parsed.data.poolName,
      transfers,
      skipped,
      message: `Sent ${transfers.length} Arc transfer${transfers.length === 1 ? "" : "s"} from your RESOLVE wallet`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Batch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
