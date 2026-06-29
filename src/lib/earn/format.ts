import { decayFactor } from "@/lib/earn/notify-policy";

export function formatDecayUrgencyLabel(stalestClaimableAt: string | null): string | null {
  if (!stalestClaimableAt) return null;
  const decay = decayFactor(new Date(stalestClaimableAt));
  if (decay >= 0.75) return "Claim soon — value is fresh";
  if (decay >= 0.4) return "Claim before urgency decays";
  return "Last chance before this drops below notify threshold";
}
