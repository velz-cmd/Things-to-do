import type { DiscoverAction } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DiscoverNeedType } from "@/lib/discover/need-types";
import { primaryBoardCtaLabel } from "@/lib/discover/need-types";
import { operationalActionsForCommunity } from "@/lib/discover/community-value-profiles";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";

export type BoardCommunityContext = {
  communitySlug: string;
  templateId: string;
  needType: DiscoverNeedType;
  communityName: string;
  installed?: boolean;
  connections?: UserConnectionState | null;
};

/** One-line use case — who the Funding board lane is for. */
export function boardUseCaseLine(role: DiscoverRole): string {
  const copy: Partial<Record<DiscoverRole, string>> = {
    funder:
      "Fund ledger programs at the top. Below: unpaid value waiting for payout rules and pools.",
    founder:
      "Set up your community once, then launch payout programs beside the tools you already run.",
    operator:
      "Connect sources to extract activity — funding is optional until value is verified.",
    dao: "Launch grant rounds, citation tolls, or fund pools for research communities.",
    community:
      "Set up where you earn — claims and payouts live on Capital.",
    all: "Verified programs first, then unpaid value you can connect, rule, and fund.",
  };
  return copy[role] ?? copy.all!;
}

/**
 * Row actions: setup is prerequisite; operational actions extract value and move money.
 */
export function boardCommunityActions(
  role: DiscoverRole,
  item: BoardCommunityContext,
): DiscoverAction[] {
  const { communitySlug, templateId, needType, communityName } = item;
  const installed =
    item.installed ??
    communityReadyForDiscover(communitySlug, item.connections) ??
    false;
  const fundLabel = primaryBoardCtaLabel(needType, {
    boardKind: "program",
    templateId,
  });

  const operational = operationalActionsForCommunity(role, {
    communitySlug,
    templateId,
    communityName,
    installed,
    connected: installed,
    connections: item.connections,
  });

  if (role === "funder") {
    const fund = operational.find((a) => a.kind === "fund");
    return [
      fund ?? {
        id: "fund",
        label: fundLabel,
        kind: "fund",
        communitySlug,
        templateId,
      },
    ];
  }

  if (!installed) {
    const attach: DiscoverAction = {
      id: "install",
      label: `Set up ${communityName}`,
      kind: "install",
      communitySlug,
      reason: "Set up once in Profile — syncs across Discover, Communities, and Capital",
    };
    return [attach, ...operational];
  }

  if (role === "community") {
    return operational.filter((a) => !/view earnings/i.test(a.label)).slice(0, 4);
  }

  if (role === "founder") {
    const program = operational.find((a) => a.kind === "create_program");
    return [
      program ?? {
        id: "program",
        label: "Create payout rule",
        kind: "create_program",
        communitySlug,
        templateId,
      },
      ...operational
        .filter((a) => a.kind !== "console" && a.id !== program?.id)
        .slice(0, 2),
    ];
  }

  if (role === "operator") {
    return operational
      .filter((a) => a.kind === "connect_sensor" || a.kind === "analyze")
      .slice(0, 3);
  }

  if (role === "dao") {
    const grant = operational.find((a) => a.templateId === "quadratic-funding");
    const fund = operational.find((a) => a.kind === "fund");
    return [
      grant ?? {
        id: "grant",
        label: "Create grant round",
        kind: "create_program",
        communitySlug,
        templateId: "quadratic-funding",
      },
      fund ?? {
        id: "fund",
        label: fundLabel,
        kind: "fund",
        communitySlug,
        templateId,
      },
      ...operational.filter((a) => a.kind === "analyze" || a.kind === "open").slice(0, 2),
    ];
  }

  return operational.length > 0
    ? operational
    : [
        {
          id: "fund",
          label: fundLabel,
          kind: "fund",
          communitySlug,
          templateId,
        },
        {
          id: "program",
          label: "Create payout rule",
          kind: "create_program",
          communitySlug,
          templateId,
        },
      ];
}

export function boardSubtitleForRole(role: DiscoverRole, signedIn: boolean, walletUsd: number | null): string {
  const wallet =
    signedIn && walletUsd != null
      ? `$${walletUsd.toFixed(2)} spendable on Arc`
      : "Sign in to fund from your Arc wallet";

  const byRole: Partial<Record<DiscoverRole, string>> = {
    funder: `Ledger-backed programs · unpaid value below · ${wallet}`,
    founder: `Set up your stack, create payout rules · ${wallet}`,
    operator: `Connect sources — extract activity before funding`,
    dao: `Grant pools and citation programs · ${wallet}`,
    community: `Set up where you earn — claims on Capital`,
    all: `Verified programs first, then unpaid value to act on · ${wallet}`,
  };
  return byRole[role] ?? byRole.all!;
}

export function radarSubtitleForRole(role: DiscoverRole): string {
  const byRole: Partial<Record<DiscoverRole, string>> = {
    funder: "Live extracted activity — fund to clear unpaid authorizations",
    founder: "Launch payout programs for this vertical",
    operator: "Connect sources — rows rank when activity is verified",
    dao: "Citations, grant pools, and treasury signals",
    community: "Set up communities on Discover — earnings on Capital.",
    all: "Real activity from connected sources — connect to extract more",
  };
  return byRole[role] ?? byRole.all!;
}

export function defaultRadarForRole(role: DiscoverRole): "oss" | "music" | "dao" {
  if (role === "community") return "music";
  if (role === "dao") return "dao";
  return "oss";
}
