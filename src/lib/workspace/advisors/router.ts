export type AdvisorSpecialist =
  | "treasury"
  | "community"
  | "attribution"
  | "connector"
  | "settlement"
  | "discovery"
  | "general";

const ROUTES: { specialist: AdvisorSpecialist; patterns: RegExp[] }[] = [
  {
    specialist: "treasury",
    patterns: [/treasury/i, /fund/i, /\$[\d,]+k?/i, /budget/i, /runway/i, /million/i, /dao/i],
  },
  {
    specialist: "settlement",
    patterns: [/settle/i, /pay/i, /claim/i, /batch/i, /arc/i, /usdc/i, /distribute/i],
  },
  {
    specialist: "discovery",
    patterns: [/discover/i, /unfunded/i, /abandon/i, /opportunit/i, /who deserves/i, /leak/i],
  },
  {
    specialist: "attribution",
    patterns: [/attribut/i, /credit/i, /composer/i, /maintainer/i, /contributor/i, /who created/i],
  },
  {
    specialist: "connector",
    patterns: [/navidrome/i, /music/i, /github/i, /peertube/i, /openalex/i, /connect/i, /sensor/i],
  },
  {
    specialist: "community",
    patterns: [/mod/i, /community/i, /governance/i, /policy/i, /percent/i, /allocate/i, /split/i],
  },
];

export function routeAdvisorSpecialist(message: string): AdvisorSpecialist {
  for (const { specialist, patterns } of ROUTES) {
    if (patterns.some((p) => p.test(message))) return specialist;
  }
  return "general";
}

export const SPECIALIST_LABELS: Record<AdvisorSpecialist, string> = {
  treasury: "Treasury Agent",
  community: "Community Agent",
  attribution: "Attribution Agent",
  connector: "Connector Agent",
  settlement: "Settlement Agent",
  discovery: "Discovery Agent",
  general: "Value Advisor",
};
