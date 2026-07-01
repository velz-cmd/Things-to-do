import type { DiscoverAction } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DiscoverNeedType } from "@/lib/discover/need-types";
import { primaryBoardCtaLabel } from "@/lib/discover/need-types";

/** Role-tailored CTAs for catalog explore rows — not one-size "Open". */
export function boardCommunityActions(
  role: DiscoverRole,
  item: {
    communitySlug: string;
    templateId: string;
    needType: DiscoverNeedType;
    communityName: string;
  },
): DiscoverAction[] {
  const { communitySlug, templateId, needType, communityName } = item;
  const fundLabel = primaryBoardCtaLabel(needType, { boardKind: "community", templateId });

  if (role === "community") {
    return [
      { id: "earn", label: "View earnings", kind: "open", href: "/capital" },
      {
        id: "console",
        label: `Open ${communityName} console`,
        kind: "console",
        communitySlug,
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
        id: "install",
        label: `Connect ${communityName}`,
        kind: "install",
        communitySlug,
      },
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
        id: "fund",
        label: fundLabel,
        kind: "fund",
        communitySlug,
        templateId,
      },
      {
        id: "grant",
        label: "Launch grant round",
        kind: "create_program",
        communitySlug,
        templateId: grantTemplate,
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
      id: "install",
      label: `Attach ${communityName}`,
      kind: "install",
      communitySlug,
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
    founder: `Deploy programs beside tools you run — install creates your community console`,
    operator: `Attach communities and keep sensors syncing — no capital required`,
    dao: `Grant pools and treasury programs — fund or launch a QF round`,
    community: `Your earnings and claimable work live on Capital — explore programs that pay creators`,
    all: `Verified programs first, then communities to attach · ${wallet}`,
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
