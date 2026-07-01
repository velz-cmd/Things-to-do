import type { DiscoverAction } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DiscoverNeedType } from "@/lib/discover/need-types";
import { primaryBoardCtaLabel } from "@/lib/discover/need-types";

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
 * Role-tailored CTAs for catalog "attach first" rows.
 * Unattached → one action (Attach). Attached → fund / launch program (never duplicate explore + console).
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

  if (!installed) {
    if (role === "community") {
      return [
        {
          id: "install",
          label: `Attach ${communityName}`,
          kind: "install",
          communitySlug,
          reason: "Installs your community console — earnings sync to Capital",
        },
      ];
    }
    if (role === "founder") {
      return [
        {
          id: "install",
          label: `Install on ${communityName}`,
          kind: "install",
          communitySlug,
        },
      ];
    }
    if (role === "operator") {
      return [
        {
          id: "install",
          label: `Connect ${communityName}`,
          kind: "install",
          communitySlug,
        },
      ];
    }
    return [
      {
        id: "install",
        label: `Attach ${communityName}`,
        kind: "install",
        communitySlug,
        reason: "One step — sensors sync in background; fund after program exists",
      },
    ];
  }

  if (role === "community") {
    return [
      { id: "earn", label: "View earnings on Capital", kind: "open", href: "/capital" },
    ];
  }

  if (role === "founder") {
    return [
      {
        id: "program",
        label: "Launch program",
        kind: "create_program",
        communitySlug,
        templateId,
      },
    ];
  }

  if (role === "operator") {
    return [
      {
        id: "console",
        label: "Open console",
        kind: "console",
        communitySlug,
      },
    ];
  }

  if (role === "dao") {
    const grantTemplate =
      templateId === "quadratic-funding" ? templateId : ("quadratic-funding" as const);
    return [
      {
        id: "grant",
        label: "Launch grant round",
        kind: "create_program",
        communitySlug,
        templateId: grantTemplate,
      },
      {
        id: "fund",
        label: fundLabel,
        kind: "fund",
        communitySlug,
        templateId,
      },
    ];
  }

  return [
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
    community: "Artist and creator value — claim on Earn, not here",
    all: "Live ledger gaps when available — attach a community to unlock more",
  };
  return byRole[role] ?? byRole.all!;
}

export function defaultRadarForRole(role: DiscoverRole): "oss" | "music" | "dao" {
  if (role === "community") return "music";
  if (role === "dao") return "dao";
  return "oss";
}
