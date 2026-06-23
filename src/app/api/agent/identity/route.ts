import { NextResponse } from "next/server";
import {
  ensureResolveAgentRegistered,
  getResolveAgentRecord,
} from "@/lib/agent/erc8004-client";
import { canRegisterAgent } from "@/lib/agent/erc8004-config";
import { hasCircleCredentials } from "@/lib/settlement/arc-config";
import { explorerTxUrl } from "@/lib/settlement/arc-config";

export async function GET() {
  const record = await getResolveAgentRecord();
  const liveReady = hasCircleCredentials() && canRegisterAgent();

  if (liveReady && !record.agentTokenId) {
    try {
      const registered = await ensureResolveAgentRegistered();
      return NextResponse.json({
        name: "RESOLVE",
        description: "Autonomous outcome engine for refunds, claims, and proof-based settlement",
        agentTokenId: registered.agentTokenId,
        registerTxHash: registered.registerTxHash,
        registerTxUrl: registered.registerTxHash
          ? explorerTxUrl(registered.registerTxHash)
          : null,
        reputationCount: record.reputationCount,
        lastReputationScore: record.lastReputationScore,
        lastReputationTxHash: record.lastReputationTxHash,
        mode: registered.mode,
        standards: ["ERC-8004", "ERC-8183"],
        liveReady,
      });
    } catch (e) {
      return NextResponse.json({
        name: "RESOLVE",
        agentTokenId: record.agentTokenId,
        registerTxHash: record.registerTxHash,
        reputationCount: record.reputationCount,
        mode: "mock",
        liveReady,
        error: e instanceof Error ? e.message : "Registration pending",
        standards: ["ERC-8004", "ERC-8183"],
      });
    }
  }

  return NextResponse.json({
    name: "RESOLVE",
    description: "Autonomous outcome engine for refunds, claims, and proof-based settlement",
    agentTokenId: record.agentTokenId,
    registerTxHash: record.registerTxHash,
    registerTxUrl: record.registerTxHash
      ? explorerTxUrl(record.registerTxHash)
      : null,
    reputationCount: record.reputationCount,
    lastReputationScore: record.lastReputationScore,
    lastReputationTxHash: record.lastReputationTxHash,
    mode: record.agentTokenId && liveReady ? "live" : "mock",
    standards: ["ERC-8004", "ERC-8183"],
    liveReady,
  });
}
