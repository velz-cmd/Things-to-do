import type { TaskStatus } from "@/lib/deputy/types";

const STATUS_PROGRESS: Record<TaskStatus, number> = {
  created: 5,
  authorized: 15,
  evidence_gathering: 30,
  planning: 45,
  executing: 60,
  waiting_for_response: 75,
  retrying: 80,
  escalated: 82,
  needs_attention: 70,
  proof_pending: 90,
  verified: 95,
  settled: 100,
  failed: 0,
  refunded: 0,
  cancelled: 0,
};

const STATUS_LABEL: Record<string, string> = {
  created: "Assigned",
  authorized: "Connectors ready",
  evidence_gathering: "Gathering evidence",
  planning: "Policy verified",
  executing: "Claim prepared",
  waiting_for_response: "Submitted",
  retrying: "Following up",
  escalated: "Escalated",
  needs_attention: "Needs attention",
  proof_pending: "Proof verified",
  verified: "Proof verified",
  settled: "Settlement released",
  failed: "Failed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export function taskProgress(status: string): number {
  return STATUS_PROGRESS[status as TaskStatus] ?? 10;
}

export function taskStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

export function taskEmoji(title: string, merchantId?: string | null): string {
  const t = (title + (merchantId ?? "")).toLowerCase();
  if (t.includes("airline") || t.includes("flight")) return "✈";
  if (t.includes("subscription") || t.includes("netflix") || t.includes("stream")) return "💳";
  if (t.includes("parcel") || t.includes("delivery")) return "📦";
  if (t.includes("wallet") || t.includes("airdrop")) return "💰";
  if (t.includes("internet") || t.includes("bill")) return "📡";
  return "🎯";
}

export const OUTCOME_EXAMPLES = [
  { label: "Cancel StreamDemo Plus", text: "Cancel StreamDemo Plus and prove billing stopped" },
  { label: "Emirates refund", text: "Get a refund from my delayed Emirates flight" },
  { label: "Find subscriptions", text: "Find subscriptions I still pay for" },
  { label: "DHL parcel claim", text: "Recover compensation for my lost DHL parcel" },
  { label: "Duplicate charge", text: "Dispute this duplicate charge" },
  { label: "SkyDemo refund", text: "Get my $43 refund from SkyDemo Airlines" },
];

export const DEMO_TIMELINE = [
  { done: true, label: "Found booking" },
  { done: true, label: "Contacted airline" },
  { done: true, label: "Followed up" },
  { done: true, label: "Refund approved" },
  { done: false, label: "+$43 recovered", highlight: true },
];
