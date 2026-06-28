import { NextResponse } from "next/server";
import { z } from "zod";
import { isAddress } from "viem";
import { requireReadyUser } from "@/lib/auth/session";
import { sendIdentityUsdc } from "@/lib/wallet/send-identity-usdc";

const bodySchema = z.object({
  destinationAddress: z.string(),
  amountUsd: z.number().min(0.01).max(10_000),
});

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success || !isAddress(parsed.data.destinationAddress)) {
    return NextResponse.json({ error: "Invalid send request" }, { status: 400 });
  }

  try {
    const result = await sendIdentityUsdc({
      user: ready.profile,
      destinationAddress: parsed.data.destinationAddress,
      amountUsd: parsed.data.amountUsd,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      message: `$${result.amountUsd.toFixed(2)} USDC sent on Arc`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
