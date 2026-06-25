import { NextResponse } from "next/server";
import {
  DECENTRALIZATION,
  PROTOCOL_GAPS,
  RESOLVE_PROTOCOL,
} from "@/lib/protocol/resolve-protocol";

/** RESOLVE protocol spec — open primitives for judges and integrators. */
export async function GET() {
  return NextResponse.json({
    ...RESOLVE_PROTOCOL,
    decentralization: DECENTRALIZATION,
    gapsWeSolve: PROTOCOL_GAPS,
    endpoints: {
      discover: "/api/discover/builders",
      agentLog: "/api/discover/agent-log",
      weight: "/api/weight/evaluate",
      challenge: "/api/weight/challenge",
      settle: "/api/payment/execute-batch",
      paymentBlueprint: "/api/payment/blueprint",
      paymentHistory: "/api/payment/history",
    },
    docs: "/docs/PROTOCOL.md",
  });
}
