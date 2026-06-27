import type { ValueDomain } from "@/lib/workspace/domains";
import { DOMAIN_LABELS, domainForConnector } from "@/lib/workspace/domains";
import type { ConnectorLiveStatus } from "@/lib/connectors/live-stats";
import type { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";

type LedgerSummary = Awaited<ReturnType<typeof getGlobalAuthorizationSummary>>;

export type DomainIntelligence = {
  domain: ValueDomain;
  label: string;
  status: "live" | "waiting" | "soon";
  eventsToday: number;
  authorizationCount: number;
  amountUsd: number;
  awaitingSettlementUsd: number;
  signal: string;
  risk?: string;
};

const SOON_DOMAINS: ValueDomain[] = ["video", "photos"];

function domainStatus(
  domain: ValueDomain,
  connectors: ConnectorLiveStatus[],
  hasAuthorizations: boolean,
): DomainIntelligence["status"] {
  if (SOON_DOMAINS.includes(domain)) return "soon";
  const relevant = connectors.filter((c) => domainForConnector(c.id) === domain);
  if (relevant.some((c) => c.health === "healthy" || hasAuthorizations)) return "live";
  if (relevant.some((c) => c.health === "syncing" || c.health === "waiting")) return "waiting";
  return "waiting";
}

function signalForDomain(
  domain: ValueDomain,
  eventsToday: number,
  authorizationCount: number,
  awaitingUsd: number,
  status: DomainIntelligence["status"],
): string {
  if (status === "soon") return "Sensors coming online";
  if (authorizationCount === 0 && eventsToday === 0) {
    if (domain === "code") return "Connect code ecosystems to detect contributions";
    if (domain === "music") return "Enable listen sync to capture plays";
    if (domain === "research") return "Connect research graph for citations";
    return "Awaiting activity";
  }
  const parts: string[] = [];
  if (eventsToday > 0) parts.push(`${eventsToday} event${eventsToday === 1 ? "" : "s"} today`);
  if (authorizationCount > 0) {
    parts.push(
      `${authorizationCount} participant${authorizationCount === 1 ? "" : "s"} recognized`,
    );
  }
  if (awaitingUsd > 0) {
    parts.push(`$${awaitingUsd.toFixed(2)} awaiting settlement`);
  }
  return parts.join(" · ");
}

/** Role/domain intelligence — never connector product names in UI. */
export function buildDomainIntelligence(input: {
  connectors: ConnectorLiveStatus[];
  ledger: LedgerSummary | null;
  todayByDomain: Map<ValueDomain, { count: number; amountUsd: number; payees: Set<string> }>;
  authByDomain: Map<ValueDomain, { count: number; amountUsd: number; awaitingUsd: number }>;
}): DomainIntelligence[] {
  const domains: ValueDomain[] = [
    "music",
    "code",
    "research",
    "feeds",
    "video",
    "documentation",
    "photos",
  ];

  return domains.map((domain) => {
    const today = input.todayByDomain.get(domain);
    const auth = input.authByDomain.get(domain);
    const eventsToday = today?.count ?? 0;
    const authorizationCount = auth?.count ?? 0;
    const amountUsd = auth?.amountUsd ?? 0;
    const awaitingSettlementUsd = auth?.awaitingUsd ?? 0;
    const status = domainStatus(domain, input.connectors, authorizationCount > 0);

    let risk: string | undefined;
    if (domain === "code" && authorizationCount > 0 && awaitingSettlementUsd > 0) {
      risk = `${authorizationCount} maintainer${authorizationCount === 1 ? "" : "s"} underfunded`;
    }
    if (domain === "music" && eventsToday > 0 && authorizationCount === 0) {
      risk = "Plays detected — attribution pending";
    }

    return {
      domain,
      label: DOMAIN_LABELS[domain],
      status,
      eventsToday,
      authorizationCount,
      amountUsd: Math.round(amountUsd * 100) / 100,
      awaitingSettlementUsd: Math.round(awaitingSettlementUsd * 100) / 100,
      signal: signalForDomain(
        domain,
        eventsToday,
        authorizationCount,
        awaitingSettlementUsd,
        status,
      ),
      risk,
    };
  });
}
