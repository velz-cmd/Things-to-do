import type { TaskStatus } from "@/lib/deputy/types";

const STATUS_PROGRESS: Record<TaskStatus, number> = {
  created: 5,
  authorized: 12,
  evidence_gathering: 28,
  planning: 35,
  executing: 48,
  waiting_for_response: 58,
  retrying: 65,
  escalated: 80,
  proof_pending: 90,
  verified: 98,
  settled: 100,
  failed: 0,
  refunded: 0,
};

const STATUS_LABEL: Record<string, string> = {
  created: "Assigned",
  authorized: "Budget locked",
  evidence_gathering: "Gathering evidence",
  planning: "Planning",
  executing: "Submitting claim",
  waiting_for_response: "Waiting response",
  retrying: "Following up",
  escalated: "Escalated",
  proof_pending: "Verifying proof",
  verified: "Verified",
  settled: "Complete",
  failed: "Failed",
  refunded: "Refunded",
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
  { label: "Recover airline refund", templateId: "airline-refund-43" },
  { label: "Cancel subscriptions", templateId: "subscription-cancel" },
  { label: "Dispute bank charge", templateId: "parcel-compensation" },
  { label: "Find forgotten assets", templateId: "forgotten-assets" },
  { label: "Protect my wallet", templateId: "wallet-protection" },
  { label: "Lower my internet bill", templateId: "internet-bill" },
];

export const DEMO_TIMELINE = [
  { done: true, label: "Found booking" },
  { done: true, label: "Contacted airline" },
  { done: true, label: "Followed up" },
  { done: true, label: "Refund approved" },
  { done: false, label: "+$43 recovered", highlight: true },
];
