import type { EcosystemRoleId } from "@/lib/capital/ecosystem-program";
import type { EcosystemActorId, EntryDoorId, ProfitEngineId } from "./types";
import { ACTOR_ENGINE_MATRIX } from "./phases";
import { ENTRY_DOORS } from "./entry-modes";
import { PROFIT_ENGINES } from "./engines";
import { CAPITAL_MODES } from "./capital-modes";

/** Map product ecosystem roles to economy actor IDs */
export const ROLE_TO_ACTOR: Record<EcosystemRoleId | "dao", EcosystemActorId> = {
  creator: "creator",
  funder: "funder",
  founder: "founder",
  operator: "operator",
  audience: "audience",
  dao: "dao_member",
};

export type RoleWorkbench = {
  roleId: EcosystemRoleId | "dao";
  actorId: EcosystemActorId;
  label: string;
  headline: string;
  engines: ReturnType<typeof PROFIT_ENGINES.filter>;
  entryDoor: (typeof ENTRY_DOORS)[number] | undefined;
  capitalModes: typeof CAPITAL_MODES;
  workflows: { step: number; title: string; detail: string; href: string }[];
  apiSurfaces: string[];
};

const ROLE_WORKFLOWS: Record<
  EcosystemRoleId | "dao",
  { step: number; title: string; detail: string; href: string }[]
> = {
  creator: [
    { step: 1, title: "Keep working upstream", detail: "GitHub, Jellyfin, Navidrome — unchanged", href: "/settings" },
    { step: 2, title: "See earnings", detail: "Connectors authorize what you earned", href: "/profile" },
    { step: 3, title: "Claim to wallet", detail: "Arc USDC with public receipt", href: "/claim" },
  ],
  funder: [
    { step: 1, title: "Discover programs", detail: "Ranked by pending obligations", href: "/capital?tab=programs" },
    { step: 2, title: "Choose return mode", detail: "Impact, sponsor, repayment, risk, or growth", href: "/program" },
    { step: 3, title: "Stake from $5", detail: "Clear queue or seed QF match pool", href: "/capital?tab=programs" },
    { step: 4, title: "Track impact", detail: "Portfolio + verified receipts", href: "/capital?tab=programs" },
  ],
  founder: [
    { step: 1, title: "Install community", detail: "Pick template beside upstream tools", href: "/communities" },
    { step: 2, title: "Connect sensors", detail: "Music, OSS, research, media tracks", href: "/settings" },
    { step: 3, title: "Deploy program", detail: "Rules authorize at event time", href: "/communities" },
    { step: 4, title: "Let strangers fund", detail: "Funders fulfill without insider access", href: "/capital?tab=programs" },
  ],
  operator: [
    { step: 1, title: "Operate one install", detail: "Whole community under one program", href: "/communities" },
    { step: 2, title: "Monitor sensors", detail: "Live authorization queue", href: "/communities" },
    { step: 3, title: "Deploy settlements", detail: "Batch payouts on Arc", href: "/communities" },
    { step: 4, title: "Measure & learn", detail: "Rebalance rules from outcomes", href: "/communities" },
  ],
  dao: [
    { step: 1, title: "Draft proposal", detail: "Policy + budget — not individual payees", href: "/program" },
    { step: 2, title: "Vote with QF weight", detail: "Community voice; RESOLVE executes rules", href: "/communities" },
    { step: 3, title: "Fund approved programs", detail: "Capital modes for treasury", href: "/capital?tab=programs" },
    { step: 4, title: "Audit receipts", detail: "On-chain proof for every payout", href: "/capital?tab=activity" },
  ],
  audience: [
    { step: 1, title: "Use upstream apps", detail: "No RESOLVE account required", href: "/discover" },
    { step: 2, title: "Value flows to creators", detail: "Sensors record; funders fulfill", href: "/discover" },
  ],
};

const ROLE_ENTRY_DOOR: Record<EcosystemRoleId | "dao", EntryDoorId> = {
  creator: "earn",
  funder: "fund",
  founder: "operate",
  operator: "operate",
  dao: "operate",
  audience: "grow",
};

export function buildRoleWorkbench(roleId: EcosystemRoleId | "dao"): RoleWorkbench {
  const actorId = ROLE_TO_ACTOR[roleId];
  const matrix = ACTOR_ENGINE_MATRIX.find((a) => a.actor === actorId);
  const engineIds = matrix?.engines ?? [];
  const engines = PROFIT_ENGINES.filter((e) => engineIds.includes(e.id));
  const entryDoor = ENTRY_DOORS.find((d) => d.id === ROLE_ENTRY_DOOR[roleId]);
  const capitalModes = CAPITAL_MODES.filter((m) =>
    m.bestFor.includes(actorId as (typeof m.bestFor)[number]),
  );

  const headlines: Record<EcosystemRoleId | "dao", string> = {
    creator: "Discover money from work you already did",
    funder: "Put capital into verified value — choose your return",
    founder: "Run programs; strangers fund; sensors authorize",
    operator: "One install, whole community economy",
    dao: "Govern policy; RESOLVE executes on the ledger",
    audience: "Zero friction — upstream apps unchanged",
  };

  const apiSurfaces = [
    ...new Set(engines.flatMap((e) => e.apiSurfaces)),
  ];

  return {
    roleId,
    actorId,
    label: matrix?.label ?? roleId,
    headline: headlines[roleId],
    engines,
    entryDoor,
    capitalModes,
    workflows: ROLE_WORKFLOWS[roleId],
    apiSurfaces,
  };
}

export function listProfessionalRoles(): Array<EcosystemRoleId | "dao"> {
  return ["funder", "founder", "operator", "dao", "creator"];
}

export function getEnginesForActor(actorId: EcosystemActorId): ProfitEngineId[] {
  return ACTOR_ENGINE_MATRIX.find((a) => a.actor === actorId)?.engines ?? [];
}
