import type { DiscoverAction } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DiscoverNeedType } from "@/lib/discover/need-types";
import { primaryBoardCtaLabel } from "@/lib/discover/need-types";
import { operationalActionsForCommunity } from "@/lib/discover/community-value-profiles";

export type BoardCommunityContext = {
  communitySlug: string;
  templateId: string;
  needType: DiscoverNeedType;
  communityName: string;
  installed?: boolean;
};

/** One-line use case — who the Opportunity board is for. */
export function boardUseCaseLine(role: DiscoverRole): string {
  const copy: Partial<Record<DiscoverRole, string>> = {
    funder:
      "For funders: top rows are ledger programs you can fund now. Below that, attach a community to unlock ranked gaps.",
    founder:
      "For founders: attach the community you run, then launch a program beside your existing tools.",
    operator:
      "For operators: attach communities to sync sensors — funding is optional.",
    dao: "For DAOs: attach a grant community, launch a QF round, or fund an existing pool.",
    community:
      "For creators: attach communities where you earn — payouts and claims live on Capital.",
    all: "Fund verified programs at the top when available. Attach a community once to install your console and unlock Gaps.",
  };
  return copy[role] ?? copy.all!;
}

/**
 * Row actions: attach is prerequisite; operational actions (fund, launch, connect) do the work.
 */
export function boardCommunityActions(
  role: DiscoverRole,
  item: BoardCommunityContext,
): DiscoverAction[] {
  const { communitySlug, templateId, needType, communityName } = item;
  const installed = item.installed ?? false;
  const fundLabel = primaryBoardCtaLabel(needType, {
    boardKind: "program",
    templateId,
  });

  const operational = operationalActionsForCommunity(role, {
    communitySlug,
    templateId,
    communityName,
    installed,
  });

  if (!installed) {
    const attach: DiscoverAction = {
      id: "install",
      label:
        role === "operator"
          ? `Connect ${communityName}`
          : role === "founder"
            ? `Install on ${communityName}`
            : `Attach ${communityName}`,
      kind: "install",
      communitySlug,
      reason: "Required once — then fund, launch programs, and extract value",
    };
    return [attach, ...operational];
  }

  if (role === "community") {
    return operational.length > 0
      ? operational
      : [{ id: "earn", label: "View earnings on Capital", kind: "open", href: "/capital" }];
  }

  if (role === "founder") {
    const program = operational.find((a) => a.kind === "create_program");
    const consoleAction = operational.find((a) => a.kind === "console");
    return [
      program ?? {
        id: "program",
        label: "Launch program",
        kind: "create_program",
        communitySlug,
        templateId,
      },
      consoleAction ?? {
        id: "console",
        label: "Open console",
        kind: "console",
        communitySlug,
      },
    ];
  }

  if (role === "operator") {
    return operational.filter((a) => a.kind === "console" || a.kind === "connect_sensor").length > 0
      ? operational
      : [
          {
            id: "console",
            label: "Open console",
            kind: "console",
            communitySlug,
          },
        ];
  }

  if (role === "dao") {
    const grant = operational.find((a) => a.templateId === "quadratic-funding");
    const fund = operational.find((a) => a.kind === "fund");
    return [
      grant ?? {
        id: "grant",
        label: "Launch grant round",
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
      ...operational.filter((a) => a.kind === "analyze" || a.kind === "open").slice(0, 1),
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
          label: "Launch program",
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
    funder: `Ledger-backed programs you can fund now · ${wallet}`,
    founder: `Attach your stack, then launch programs · ${wallet}`,
    operator: `Attach communities — sensors sync without funding`,
    dao: `Grant pools and treasury programs · ${wallet}`,
    community: `Attach where you earn — claims on Capital`,
    all: `Verified programs first, then attach to unlock · ${wallet}`,
  };
  return byRole[role] ?? byRole.all!;
}

export function radarSubtitleForRole(role: DiscoverRole): string {
  const byRole: Partial<Record<DiscoverRole, string>> = {
    funder: "Verified gaps in this domain — fund to clear ledger authorizations",
    founder: "Launch programs and attach sensors for this vertical",
    operator: "Connect sources — cards appear when ledger rows rank up",
    dao: "Grant pools, citations, and treasury signals",
    community: "Attach communities on Board — earnings aggregate on the Earnings tab.",
    all: "Live ledger gaps when available — attach any catalog community to unlock more",
  };
  return byRole[role] ?? byRole.all!;
}

export function defaultRadarForRole(role: DiscoverRole): "oss" | "music" | "dao" {
  if (role === "community") return "music";
  if (role === "dao") return "dao";
  return "oss";
}
