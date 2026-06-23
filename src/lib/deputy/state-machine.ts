import { createHash } from "crypto";
import type { AgentRole, TaskStatus } from "./types";
import { TASK_TRANSITIONS } from "./types";

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}

export function hashProofPayload(payload: unknown): string {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  return "0x" + createHash("sha256").update(raw).digest("hex");
}

export function agentForStatus(status: TaskStatus): AgentRole {
  switch (status) {
    case "planning":
      return "Planner";
    case "evidence_gathering":
      return "Evidence";
    case "executing":
      return "Executor";
    case "retrying":
    case "waiting_for_response":
      return "Retry";
    case "escalated":
    case "needs_attention":
      return "Escalation";
    case "proof_pending":
    case "verified":
    case "settled":
      return "Verification";
    default:
      return "Planner";
  }
}

export const EXECUTION_STEPS: Array<{
  status: TaskStatus;
  agent: AgentRole;
  message: string;
  costUsd: number;
  delayMs: number;
}> = [
  {
    status: "authorized",
    agent: "Planner",
    message: "Outcome checklist created — target refund $TARGET",
    costUsd: 0.002,
    delayMs: 400,
  },
  {
    status: "evidence_gathering",
    agent: "Evidence",
    message: "Located booking reference and delay eligibility proof",
    costUsd: 0.008,
    delayMs: 600,
  },
  {
    status: "planning",
    agent: "Planner",
    message: "Claim strategy selected — EU261-style compensation pathway",
    costUsd: 0.003,
    delayMs: 500,
  },
  {
    status: "executing",
    agent: "Executor",
    message: "Submitted compensation claim to merchant portal",
    costUsd: 0.015,
    delayMs: 800,
  },
  {
    status: "waiting_for_response",
    agent: "Retry",
    message: "Awaiting merchant response — follow-up scheduled",
    costUsd: 0.001,
    delayMs: 700,
  },
  {
    status: "retrying",
    agent: "Retry",
    message: "Sent escalation follow-up with attached evidence package",
    costUsd: 0.012,
    delayMs: 900,
  },
  {
    status: "proof_pending",
    agent: "Verification",
    message: "Merchant proof received — running verification engine",
    costUsd: 0.005,
    delayMs: 600,
  },
];
