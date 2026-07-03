import type { CommunityKind } from "@/lib/mission/community/types";

export type CommunityQuickActionId =
  | "create_program"
  | "connect_source"
  | "review_obligations"
  | "approve_payouts";

export type CommunityQuickActionDef = {
  id: CommunityQuickActionId;
  label: string;
};

export function quickActionsForKind(kind: CommunityKind): CommunityQuickActionDef[] {
  switch (kind) {
    case "music":
      return [
        { id: "create_program", label: "Create program" },
        { id: "connect_source", label: "Connect ListenBrainz" },
        { id: "review_obligations", label: "Review plays" },
        { id: "approve_payouts", label: "Approve artist payouts" },
      ];
    case "oss":
    case "protocol":
    case "wiki":
      return [
        { id: "create_program", label: "Create program" },
        { id: "connect_source", label: "Connect GitHub" },
        { id: "review_obligations", label: "Review PR obligations" },
        { id: "approve_payouts", label: "Approve merge payouts" },
      ];
    case "research":
    case "science":
      return [
        { id: "create_program", label: "Create program" },
        { id: "connect_source", label: "Connect OpenAlex" },
        { id: "review_obligations", label: "Review citations" },
        { id: "approve_payouts", label: "Approve toll payouts" },
      ];
    case "media":
      return [
        { id: "create_program", label: "Create program" },
        { id: "connect_source", label: "Connect Jellyfin" },
        { id: "review_obligations", label: "Review watches" },
        { id: "approve_payouts", label: "Approve creator payouts" },
      ];
    default:
      return [
        { id: "create_program", label: "Create program" },
        { id: "connect_source", label: "Connect source" },
        { id: "review_obligations", label: "Review obligations" },
        { id: "approve_payouts", label: "Approve payouts" },
      ];
  }
}
