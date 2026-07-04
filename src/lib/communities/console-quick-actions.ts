import type { CommunityKind } from "@/lib/mission/community/types";

export type CommunityQuickActionId =
  | "create_program"
  | "connect_source"
  | "review_obligations"
  | "approve_payouts";

export type CommunityQuickActionDef = {
  id: CommunityQuickActionId;
  label: string;
  description: string;
};

export function quickActionsForKind(kind: CommunityKind): CommunityQuickActionDef[] {
  switch (kind) {
    case "music":
      return [
        { id: "create_program", label: "Create Royalty Program", description: "Draft a per-play artist payout rule." },
        { id: "connect_source", label: "Connect Music Source", description: "Use Profile connections for plays and attribution." },
        { id: "review_obligations", label: "Review Play Obligations", description: "Open royalties waiting for pool funding." },
        { id: "approve_payouts", label: "Settle Artist Payouts", description: "Send ready payouts on Arc." },
      ];
    case "oss":
    case "protocol":
    case "wiki":
      return [
        { id: "create_program", label: "Create Payout Program", description: "Draft docs, security, or maintainer rules." },
        { id: "connect_source", label: "Connect GitHub", description: "Verify contributors through Profile." },
        { id: "review_obligations", label: "Review Contributor Payouts", description: "Inspect authorized PR and docs rewards." },
        { id: "approve_payouts", label: "Settle Contributor Payouts", description: "Send ready maintainer payouts on Arc." },
      ];
    case "research":
    case "science":
      return [
        { id: "create_program", label: "Create Citation Program", description: "Draft citation toll or grant rules." },
        { id: "connect_source", label: "Connect Research Source", description: "Use OpenAlex/Crossref proof from Profile." },
        { id: "review_obligations", label: "Review Citation Rewards", description: "Inspect author rewards waiting to settle." },
        { id: "approve_payouts", label: "Settle Research Rewards", description: "Send ready author payouts on Arc." },
      ];
    case "media":
      return [
        { id: "create_program", label: "Create Watch Program", description: "Draft pay-per-minute creator rules." },
        { id: "connect_source", label: "Connect Jellyfin", description: "Verify playback proof from Profile." },
        { id: "review_obligations", label: "Review Watch Rewards", description: "Inspect creator payouts from watch time." },
        { id: "approve_payouts", label: "Settle Creator Payouts", description: "Send ready creator payouts on Arc." },
      ];
    default:
      return [
        { id: "create_program", label: "Create Payout Program", description: "Draft the community payout rule." },
        { id: "connect_source", label: "Connect Source", description: "Use Profile connections for proof." },
        { id: "review_obligations", label: "Review Obligations", description: "Inspect verified payouts." },
        { id: "approve_payouts", label: "Settle Payouts", description: "Send ready payouts on Arc." },
      ];
  }
}
