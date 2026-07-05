import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import {
  resolvePaymentRoute,
  type WalletPaymentAction,
} from "@/lib/wallet/payment-routes";

export const dynamic = "force-dynamic";

const ACTIONS: WalletPaymentAction[] = ["deposit", "program_fund", "agent_signal"];

export async function GET(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const url = new URL(req.url);
  const actionParam = url.searchParams.get("action") ?? "program_fund";
  if (!ACTIONS.includes(actionParam as WalletPaymentAction)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const route = resolvePaymentRoute(
    actionParam as WalletPaymentAction,
    ready.profile.walletAddress,
  );

  if ("error" in route) {
    return NextResponse.json({ ok: false, error: route.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    ...route,
  });
}
