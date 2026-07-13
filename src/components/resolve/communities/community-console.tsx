"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileSearch,
  Fingerprint,
  Gauge,
  GitMerge,
  Loader2,
  MoreHorizontal,
  Radio,
  RefreshCw,
  Route,
  ScrollText,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
  UsersRound,
  WalletCards,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { CommunitySensorPanel } from "@/components/resolve/communities/community-sensor-panel";
import { CommunityBridgePanel } from "@/components/resolve/communities/community-bridge-panel";
import { PROGRAM_TEMPLATES } from "@/lib/communities/catalog";
import type { CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { CommunitySurface, ProgramRecord } from "@/lib/communities/types";
import { profileConnectPath } from "@/lib/communities/community-nav";
import { communityLinkedViaProfile } from "@/lib/discover/community-profile-link";
import { getCommunityNextBestAction } from "@/lib/communities/next-best-action";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { CommunityDomainIcon, communityOperationsDescription } from "./community-identity";
import { CommunityIdentityDesk } from "./community-identity-desk";
import { CommunityObligationsDesk } from "./community-obligations-desk";
import styles from "./communities.module.css";

type ConsoleTab = "overview" | "programs" | "obligations" | "identities" | "sources" | "activity" | "readiness";

const TABS: Array<{ id: ConsoleTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "programs", label: "Programs" },
  { id: "obligations", label: "Obligations" },
  { id: "identities", label: "Identity Desk" },
  { id: "sources", label: "Sources" },
  { id: "activity", label: "Activity" },
  { id: "readiness", label: "Settlement Readiness" },
];

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function programRulesLabel(program: ProgramRecord): string {
  const template = PROGRAM_TEMPLATES[program.templateId as keyof typeof PROGRAM_TEMPLATES];
  if (program.rules.perPlayUsd) return `$${program.rules.perPlayUsd} per verified play`;
  if (program.rules.perWatchUsd) return `$${program.rules.perWatchUsd} per verified watch`;
  if (program.rules.perCitationUsd) return `$${program.rules.perCitationUsd} per verified citation`;
  if (program.rules.perMergeUsd) return `$${program.rules.perMergeUsd} per accepted contribution`;
  return template?.description ?? humanize(program.templateId);
}

function eventIcon(eventType: string) {
  if (eventType.includes("identity")) return Fingerprint;
  if (eventType.includes("source") || eventType.includes("sync")) return Radio;
  if (eventType.includes("settle") || eventType.includes("receipt")) return BadgeCheck;
  if (eventType.includes("program") || eventType.includes("policy")) return ScrollText;
  return Activity;
}

type Props = {
  slug: string;
  catalog: CommunityCatalogEntry;
  surface: CommunitySurface;
  connections: UserConnectionState;
  busy: boolean;
  obligationsFilter: "all" | "pending";
  onObligationsFilterChange: (filter: "all" | "pending") => void;
  onRequestCreateProgram: () => void;
  onRefresh: () => void;
  initialTab?: ConsoleTab;
};

type RecommendedActionView = {
  actionId: import("@/lib/actions/types").ResolveActionId;
  eyebrow: string;
  title: string;
  why: string;
  result: string;
  action: string;
  href?: string;
  onClick?: () => void;
};

export function CommunityConsole({
  slug,
  catalog,
  surface,
  connections,
  busy,
  obligationsFilter,
  onObligationsFilterChange,
  onRequestCreateProgram,
  onRefresh,
  initialTab = "overview",
}: Props) {
  const [tab, setTab] = useState<ConsoleTab>(initialTab);
  const sourcesConnected = connections.hasAnyConnector || communityLinkedViaProfile(slug, connections);
  const programs = surface.programs ?? [];
  const readiness = surface.deployReadiness;
  const identityResolved = surface.operatingFacts.resolvedIdentityCount;
  const identityUnresolved = surface.operatingFacts.unresolvedIdentityCount;
  const connectorHealthy = surface.health.connectorStatus.filter((source) => ["healthy", "connected", "live"].includes(source.health.toLowerCase())).length;
  const activePrograms = programs.filter((program) => ["active", "deployed"].includes(program.status)).length;
  const simulationComplete = surface.operatingFacts.simulationComplete;

  useEffect(() => {
    setTab(initialTab);
    const hash = window.location.hash;
    if (hash === "#settlement-readiness") setTab("readiness");
    if (hash === "#obligations") setTab("obligations");
    if (hash === "#programs") setTab("programs");
  }, [initialTab]);

  const nextAction = useMemo(
    () =>
      getCommunityNextBestAction({
        installed: surface.installed,
        sourceConnected: sourcesConnected,
        sourceHealthy: connectorHealthy > 0,
        syncCompleted: Boolean(surface.health.lastScrobbleAt || connectorHealthy > 0),
        programCount: programs.length,
        unresolvedIdentityCount: identityUnresolved,
        obligationCount: readiness?.authorizedCount ?? 0,
        simulationComplete,
        fundingGapUsd: readiness?.fundingGapUsd ?? 0,
        settlementReady: Boolean(readiness?.canDeploy && simulationComplete),
      }),
    [connectorHealthy, identityUnresolved, programs.length, readiness, simulationComplete, sourcesConnected, surface.health.lastScrobbleAt, surface.installed],
  );

  const recommended = useMemo<RecommendedActionView>(() => {
    const base = {
      actionId: nextAction.actionId,
      eyebrow: humanize(nextAction.state),
      title: nextAction.label,
      why: nextAction.reason,
      result: nextAction.expectedResult,
      action: nextAction.label,
    };
    switch (nextAction.actionId) {
      case "source.connect":
        return { ...base, href: profileConnectPath(`/communities/${slug}`) };
      case "source.sync":
      case "source.view_status":
        return { ...base, onClick: () => setTab("sources") };
      case "program.create_draft":
        return { ...base, onClick: onRequestCreateProgram };
      case "identity.confirm_match":
        return { ...base, onClick: () => setTab("identities") };
      case "obligation.review":
        return { ...base, onClick: () => setTab("obligations") };
      case "mission.simulate":
        return { ...base, href: `/mission?community=${encodeURIComponent(slug)}&mode=simulate` };
      case "capital.open_funding":
      case "obligation.prepare_settlement":
        return { ...base, href: `/capital?community=${encodeURIComponent(slug)}` };
      default:
        return { ...base, href: `/communities/${encodeURIComponent(slug)}` };
    }
  }, [nextAction, onRequestCreateProgram, slug]);

  function openTab(nextTab: ConsoleTab) {
    setTab(nextTab);
    window.requestAnimationFrame(() => document.getElementById("community-console-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className={styles.console}>
      <header className={styles.consoleHeader}>
        <div className={styles.consoleIdentity}>
          <span className={styles.domainIcon}><CommunityDomainIcon slug={slug} kind={catalog.kind} /></span>
          <div>
            <p className={styles.eyebrow}>Community console</p>
            <h1>{catalog.name}</h1>
            <p>{communityOperationsDescription(catalog.kind)}</p>
          </div>
        </div>
        <div className={styles.consoleStatus}>
          <span data-state={readiness?.canDeploy ? "ready" : sourcesConnected ? "healthy" : "setup"}><i />{readiness?.canDeploy ? "Settlement ready" : sourcesConnected ? "Operating" : "Needs setup"}</span>
          <div className={styles.consoleActions}>
            {!recommended.href && <button data-action-id={recommended.actionId} type="button" className={styles.primaryButton} onClick={() => recommended.onClick?.()}><Sparkles /> {recommended.action}</button>}
            {recommended.href && <Link data-action-id={recommended.actionId} href={recommended.href} className={styles.primaryButton}><ArrowRight /> {recommended.action}</Link>}
            <Link data-action-id="mission.create" href={`/mission?community=${slug}`} className={styles.secondaryButton}>Run Mission <ArrowUpRight /></Link>
            <details className={styles.moreMenu}><summary aria-label="More community actions"><MoreHorizontal /></summary><div><Link data-action-id="source.connect" href={profileConnectPath(`/communities/${slug}`)}>Manage connections</Link><Link data-action-id="program.open_in_discover" href={`/discover?community=${slug}`}>View in Discover</Link></div></details>
          </div>
        </div>
      </header>

      <nav id="community-console-tabs" className={styles.consoleTabs} aria-label="Community console sections">
        {TABS.map((item) => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </nav>

      {tab === "overview" && (
        <div className={styles.tabPanel}>
          <section className={styles.operationsMap} aria-labelledby="operations-map-title">
            <div className={styles.panelHeading}><div><p className={styles.sectionKicker}>Live architecture</p><h2 id="operations-map-title">Community Operations Map</h2></div><span>Evidence → readiness</span></div>
            <div className={styles.mapFlow}>
              <MapNode icon={Radio} label="Sources" value={`${connectorHealthy}/${surface.health.connectorStatus.length} healthy`} tone={connectorHealthy > 0 ? "healthy" : "attention"} onClick={() => openTab("sources")} />
              <ArrowDown />
              <MapNode icon={Fingerprint} label="Identities" value={`${identityResolved} resolved · ${identityUnresolved} review`} tone={identityUnresolved ? "review" : "healthy"} onClick={() => openTab("identities")} />
              <ArrowDown />
              <MapNode icon={ShieldCheck} label="Program rules" value={programs.length ? `${programs.length} configured` : "Not configured"} tone={programs.length ? "policy" : "attention"} onClick={() => openTab("programs")} />
              <ArrowDown />
              <MapNode icon={ScrollText} label="Obligations" value={`${readiness?.authorizedCount ?? 0} recognized`} tone={(readiness?.authorizedCount ?? 0) ? "evidence" : "muted"} onClick={() => openTab("obligations")} />
              <ArrowDown />
              <MapNode icon={Route} label="Settlement" value={readiness?.canDeploy ? "Ready" : "Blocked"} tone={readiness?.canDeploy ? "healthy" : "review"} onClick={() => openTab("readiness")} />
            </div>
          </section>

          <section className={styles.overviewGrid}>
            <div className={styles.recommendedPanel}>
              <p className={styles.sectionKicker}>Next operation · {recommended.eyebrow}</p>
              <h2>{recommended.title}</h2>
              <dl><div><dt>Why</dt><dd>{recommended.why}</dd></div><div><dt>Expected result</dt><dd>{recommended.result}</dd></div></dl>
              <div className={styles.inlineActions}>
                {recommended.href ? <Link data-action-id={recommended.actionId} href={recommended.href} className={styles.primaryButton}>{recommended.action}<ArrowRight /></Link> : <button data-action-id={recommended.actionId} type="button" className={styles.primaryButton} onClick={recommended.onClick}>{recommended.action}<ArrowRight /></button>}
                <Link data-action-id="mission.create" href={`/mission?community=${slug}`} className={styles.secondaryButton}>Run Mission analysis</Link>
              </div>
            </div>
            <div className={styles.operationsSummary}>
              <p className={styles.sectionKicker}>Operations summary</p>
              <div>
                <Metric label="Programs" value={`${activePrograms} active`} />
                <Metric label="Sources" value={`${connectorHealthy} healthy`} />
                <Metric label="Identities" value={`${identityResolved} resolved`} />
                <Metric label="Obligations" value={`${readiness?.authorizedCount ?? 0} recognized`} />
                <Metric label="Last sync" value={surface.health.lastScrobbleAt ? new Date(surface.health.lastScrobbleAt).toLocaleString() : "No sync recorded"} />
                <Metric label="Settlement" value={readiness?.canDeploy ? "Ready" : "Needs review"} tone={readiness?.canDeploy ? "healthy" : "review"} />
              </div>
            </div>
          </section>

          <CommunityActionQueue
            slug={slug}
            primary={recommended}
            unresolved={identityUnresolved}
            obligationCount={readiness?.authorizedCount ?? 0}
            simulationComplete={simulationComplete}
            fundingGapUsd={readiness?.fundingGapUsd ?? 0}
            onTab={openTab}
          />

          <SettlementReadiness slug={slug} surface={surface} unresolved={identityUnresolved} onTab={openTab} />

          <section className={styles.bottomGrid}>
            <div className={styles.ledgerPanel}><div className={styles.panelHeading}><div><p className={styles.sectionKicker}>Recent operations</p><h2>Activity ledger</h2></div><button type="button" onClick={() => openTab("activity")}>View all</button></div><ActivityRows timeline={surface.timeline.slice(0, 4)} /></div>
            <div className={styles.attentionPanel}><p className={styles.sectionKicker}>Attention items</p><h2>Operational blockers</h2>{readiness?.reasons?.length ? <ul>{readiness.reasons.map((reason) => <li key={reason}><CircleAlert />{reason}</li>)}</ul> : <p className={styles.cleanState}><CheckCircle2 /> No current blockers in the settlement-readiness model.</p>}</div>
          </section>
        </div>
      )}

      {tab === "programs" && <ProgramsTab slug={slug} programs={programs} busy={busy} onCreate={onRequestCreateProgram} onSaved={onRefresh} />}
      {tab === "obligations" && <CommunityObligationsDesk slug={slug} filter={obligationsFilter} onFilter={onObligationsFilterChange} onOpenIdentityDesk={() => openTab("identities")} />}
      {tab === "identities" && <CommunityIdentityDesk slug={slug} />}
      {tab === "sources" && <SourcesTab slug={slug} surface={surface} connected={sourcesConnected} onRefresh={onRefresh} />}
      {tab === "activity" && <ActivityTab timeline={surface.timeline} />}
      {tab === "readiness" && <div className={styles.tabPanel}><SettlementReadiness slug={slug} surface={surface} unresolved={identityUnresolved} onTab={openTab} /></div>}
    </div>
  );
}

function MapNode({ icon: Icon, label, value, tone, onClick }: { icon: LucideIcon; label: string; value: string; tone: string; onClick: () => void }) {
  return <button type="button" className={styles.mapNode} data-tone={tone} onClick={onClick}><Icon /><span>{label}</span><strong>{value}</strong></button>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className={styles.metric}><span>{label}</span><strong data-tone={tone}>{value}</strong></div>;
}

function CommunityActionQueue({
  slug,
  primary,
  unresolved,
  obligationCount,
  simulationComplete,
  fundingGapUsd,
  onTab,
}: {
  slug: string;
  primary: RecommendedActionView;
  unresolved: number;
  obligationCount: number;
  simulationComplete: boolean;
  fundingGapUsd: number;
  onTab: (tab: ConsoleTab) => void;
}) {
  const items: Array<RecommendedActionView & { urgency: string; dependency: string; destination: string }> = [
    {
      ...primary,
      urgency: primary.actionId === "obligation.prepare_settlement" ? "Ready" : "Now",
      dependency: "Current highest-priority operating dependency",
      destination: primary.actionId.startsWith("mission.") ? "Mission" : primary.actionId.startsWith("capital.") || primary.actionId === "obligation.prepare_settlement" ? "Capital" : primary.actionId.startsWith("source.connect") ? "Profile" : "Communities",
    },
  ];
  if (unresolved > 0 && primary.actionId !== "identity.confirm_match") {
    items.push({
      actionId: "identity.confirm_match",
      eyebrow: "Identity blocker",
      title: "Resolve payout identities",
      why: `${unresolved} observed ${unresolved === 1 ? "identity has" : "identities have"} no confirmed payout destination.`,
      result: "The affected obligations can enter settlement review.",
      action: "Open Identity Desk",
      onClick: () => onTab("identities"),
      urgency: "High",
      dependency: "Requires source evidence or identity proof",
      destination: "Communities",
    });
  }
  if (obligationCount > 0 && !simulationComplete && primary.actionId !== "mission.simulate") {
    items.push({
      actionId: "mission.simulate",
      eyebrow: "Decision control",
      title: "Simulate the prepared policy",
      why: "Recognized obligations must be simulated before authorization.",
      result: "Payee effects, totals, and the funding gap become reviewable.",
      action: "Open Mission",
      href: `/mission?community=${encodeURIComponent(slug)}&mode=simulate`,
      urgency: "High",
      dependency: "Requires a persisted program policy",
      destination: "Mission",
    });
  }
  if (fundingGapUsd > 0 && primary.actionId !== "capital.open_funding") {
    items.push({
      actionId: "capital.open_funding",
      eyebrow: "Capital dependency",
      title: "Fund the settlement requirement",
      why: `$${fundingGapUsd.toFixed(2)} is required before the prepared obligations can settle.`,
      result: "The exact funding intent opens without rebuilding the community decision.",
      action: "Open Capital",
      href: `/capital?community=${encodeURIComponent(slug)}`,
      urgency: "High",
      dependency: "Requires a funded wallet and user authorization",
      destination: "Capital",
    });
  }

  return (
    <section className={styles.ledgerPanel} aria-labelledby="community-action-queue-title">
      <div className={styles.panelHeading}>
        <div><p className={styles.sectionKicker}>Ordered operations</p><h2 id="community-action-queue-title">Community Action Queue</h2></div>
        <span>{items.length} actionable</span>
      </div>
      <ol className={styles.activityList}>
        {items.map((item, index) => (
          <li key={`${item.actionId}-${index}`}>
            <span><Route /></span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.why}</p>
              <p>{item.urgency} · {item.dependency} · Opens in {item.destination}</p>
            </div>
            {item.href ? (
              <Link data-action-id={item.actionId} href={item.href} className={styles.secondaryButton}>{item.action}<ArrowRight /></Link>
            ) : (
              <button data-action-id={item.actionId} type="button" className={styles.secondaryButton} onClick={item.onClick}>{item.action}<ArrowRight /></button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function SettlementReadiness({ slug, surface, unresolved, onTab }: { slug: string; surface: CommunitySurface; unresolved: number; onTab: (tab: ConsoleTab) => void }) {
  const router = useRouter();
  const [preparing, setPreparing] = useState(false);
  const readiness = surface.deployReadiness;
  const simulationComplete = surface.operatingFacts.simulationComplete;
  const programValid = surface.programs.length > 0;
  const evidenceComplete = readiness.authorizedCount > 0;
  const identitiesValid = unresolved === 0 && evidenceComplete;
  const policyValid = programValid;
  const obligationsValid = readiness.authorizedCount > 0;
  const capitalValid = readiness.fundingGapUsd <= 0.01;
  const authorizationStatus = surface.operatingFacts.authorizationStatus;
  const prerequisitesReady = programValid && evidenceComplete && identitiesValid && policyValid && obligationsValid && simulationComplete && capitalValid;

  async function prepareSettlementPackage() {
    const programId = surface.programs[0]?.id;
    if (!programId) return;
    setPreparing(true);
    try {
      const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/settlement-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          returnTo: `/communities/${encodeURIComponent(slug)}?tab=console`,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; capitalUrl?: string } | null;
      if (!response.ok || !payload?.capitalUrl) throw new Error(payload?.error ?? "Could not compile the settlement package");
      router.push(payload.capitalUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not compile the settlement package");
    } finally {
      setPreparing(false);
    }
  }

  const primary = !programValid
    ? <button data-action-id="program.create_draft" data-testid="readiness-create-program" type="button" onClick={() => onTab("programs")}><ShieldCheck /> Configure program</button>
    : !evidenceComplete
      ? <button data-action-id="source.sync" data-testid="readiness-sync-source" type="button" onClick={() => onTab("sources")}><Radio /> Synchronize source</button>
      : !identitiesValid
        ? <button data-action-id="identity.confirm_match" data-testid="readiness-resolve-identities" type="button" onClick={() => onTab("identities")}><Fingerprint /> Resolve identities</button>
        : !simulationComplete
          ? <Link data-action-id="mission.simulate" data-testid="readiness-run-simulation" href={`/mission?community=${encodeURIComponent(slug)}&mode=simulate`}><Gauge /> Run simulation in Mission</Link>
          : !capitalValid
            ? <Link data-action-id="capital.open_funding" data-testid="readiness-open-capital" href={`/capital?community=${encodeURIComponent(slug)}`}><WalletCards /> Open Capital</Link>
            : authorizationStatus === "submitted"
              ? <Link data-action-id="capital.retry_confirmation" data-testid="readiness-pending-transaction" href={`/capital?community=${encodeURIComponent(slug)}&tab=activity`}><Clock3 /> Open pending transaction</Link>
              : authorizationStatus === "confirmed"
                ? <Link data-action-id="receipt.open" data-testid="readiness-view-receipt" href={`/capital?community=${encodeURIComponent(slug)}&tab=activity`}><BadgeCheck /> View confirmed receipt</Link>
                : <button data-action-id="obligation.prepare_settlement" data-testid="readiness-review-authorization" type="button" disabled={preparing} onClick={() => void prepareSettlementPackage()} className={styles.cardPrimary}>{preparing ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{preparing ? "Compiling packageâ€¦" : "Review authorization"} <ArrowRight /></button>;
  return (
    <section id="settlement-readiness" className={styles.settlementDesk}>
      <div className={styles.panelHeading}><div><p className={styles.sectionKicker}>Capital handoff</p><h2>Settlement Readiness Desk</h2></div><span data-state={prerequisitesReady ? "ready" : "review"}>{prerequisitesReady ? "Ready to prepare" : "Blocked"}</span></div>
      <div className={styles.readinessGrid}>
        <Metric label="Program" value={programValid ? "Valid" : "Required"} tone={programValid ? "healthy" : "review"} />
        <Metric label="Evidence" value={evidenceComplete ? `${readiness.authorizedCount} complete` : "Missing"} tone={evidenceComplete ? "healthy" : "review"} />
        <Metric label="Identities" value={unresolved ? `${unresolved} unresolved` : `${surface.operatingFacts.resolvedIdentityCount} resolved`} tone={identitiesValid ? "healthy" : "review"} />
        <Metric label="Policy" value={policyValid ? "Valid" : "Required"} tone={policyValid ? "healthy" : "review"} />
        <Metric label="Obligations" value={obligationsValid ? `${readiness.authorizedCount} recognized` : "None"} tone={obligationsValid ? "healthy" : "review"} />
        <Metric label="Simulation" value={simulationComplete ? "Completed" : "Not completed"} tone={simulationComplete ? "healthy" : "review"} />
        <Metric label="Capital" value={capitalValid ? "Available" : `$${readiness.fundingGapUsd.toFixed(2)} required`} tone={capitalValid ? "healthy" : "review"} />
        <Metric label="Authorization" value={authorizationStatus ? humanize(authorizationStatus) : "Not started"} tone={authorizationStatus === "confirmed" ? "healthy" : "review"} />
      </div>
      <div className={styles.readinessActions}>{primary}</div>
    </section>
  );
}

function ProgramsTab({ slug, programs, busy, onCreate, onSaved }: { slug: string; programs: ProgramRecord[]; busy: boolean; onCreate: () => void; onSaved: () => void }) {
  return (
    <section className={styles.tabPanel}>
      <div className={styles.tabIntro}><div><p className={styles.sectionKicker}>Policy operations</p><h2>Programs</h2><p>Programs convert verified evidence into recognized obligations. Capital requirements are handed to Capital.</p></div><button data-action-id="program.create_draft" type="button" className={styles.primaryButton} onClick={onCreate} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <GitMerge />} Create program</button></div>
      {programs.length ? <div className={styles.programList}>{programs.map((program) => {
        const readiness = program.deployReadiness;
        return <article key={program.id} className={styles.programRecord}>
          <div className={styles.programTitle}><span><ShieldCheck /></span><div><h3>{program.name}</h3><p>{humanize(program.templateId)}</p></div><strong data-state={program.status}>{humanize(program.status)}</strong></div>
          <dl>
            <div><dt>Evidence source</dt><dd>{program.rules.connectorId ? humanize(program.rules.connectorId) : "Not configured"}</dd></div>
            <div><dt>Rule</dt><dd>{programRulesLabel(program)}</dd></div>
            <div><dt>Eligibility</dt><dd>Verified source identity required</dd></div>
            <div><dt>Recognized obligations</dt><dd>${(readiness?.pendingObligationsUsd ?? 0).toFixed(2)}</dd></div>
            <div><dt>Status</dt><dd>{readiness?.canDeploy ? "Settlement ready" : readiness?.reasons?.[0] ?? "Review required"}</dd></div>
          </dl>
          <PolicySandbox slug={slug} program={program} onSaved={onSaved} />
          {readiness && readiness.fundingGapUsd > 0 && <div className={styles.capitalRequirement}><span><WalletCards /> Capital requirement</span><strong>${readiness.fundingGapUsd.toFixed(2)} required before settlement</strong><Link data-action-id="capital.open_funding" href={`/capital?community=${slug}&program=${program.id}`}>Open Capital <ArrowUpRight /></Link></div>}
          <div className={styles.inlineActions}>
            <Link data-action-id="program.update_policy" data-testid={`program-review-${program.id}`} href={`/mission?community=${slug}&program=${program.missionId ?? program.id}`} className={styles.secondaryButton}>Review policy</Link>
            <Link data-action-id="program.simulate" data-testid={`program-simulate-${program.id}`} href={`/mission?community=${slug}&program=${program.missionId ?? program.id}&mode=simulate`} className={styles.secondaryButton}>Simulate in Mission</Link>
            <details className={styles.moreMenu}><summary aria-label={`More actions for ${program.name}`}><MoreHorizontal /></summary><div><Link data-action-id="program.open_passport" href={`/programs/${program.id}`}>Public passport</Link><Link data-action-id="program.open_in_discover" href={`/discover?program=${program.id}`}>View opportunity in Discover</Link></div></details>
          </div>
        </article>;
      })}</div> : <div className={styles.emptyState}><BookOpenCheck /><p>No operating policy exists yet. Create a draft program to evaluate verified evidence.</p><button data-action-id="program.create_draft" type="button" onClick={onCreate}>Create program</button></div>}
    </section>
  );
}

function PolicySandbox({ slug, program, onSaved }: { slug: string; program: ProgramRecord; onSaved: () => void }) {
  const [allocationRule, setAllocationRule] = useState<NonNullable<ProgramRecord["rules"]["allocationRule"]>>(program.rules.allocationRule ?? "verified_activity");
  const [eligibilityMode, setEligibilityMode] = useState<NonNullable<ProgramRecord["rules"]["eligibilityMode"]>>(program.rules.eligibilityMode ?? "resolved_only");
  const [saving, setSaving] = useState(false);
  const readiness = program.deployReadiness;
  const unresolved = Math.max(0, (readiness?.authorizedCount ?? 0) - (readiness?.walletMappedCount ?? 0));

  async function savePolicyVersion() {
    setSaving(true);
    try {
      const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/programs/${encodeURIComponent(program.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `program-policy:${program.id}:${allocationRule}:${eligibilityMode}`,
        },
        body: JSON.stringify({ rules: { allocationRule, eligibilityMode } }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Policy version could not be saved");
      toast.success("New immutable policy version saved");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Policy update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className={styles.policySandbox}>
      <summary><span><Gauge /> Policy Sandbox</span><small>Preview impact · no money moves</small></summary>
      <div className={styles.policySandboxBody}>
        <p className={styles.sectionKicker}>If this policy were active</p>
        <div className={styles.policyMetrics}>
          <Metric label="Eligible creators" value={`${readiness?.walletMappedCount ?? 0}`} />
          <Metric label="Unresolved identities" value={`${unresolved}`} tone={unresolved ? "review" : "healthy"} />
          <Metric label="Recognized obligations" value={`$${(readiness?.pendingObligationsUsd ?? 0).toFixed(2)}`} />
          <Metric label="Evidence coverage" value={(readiness?.authorizedCount ?? 0) > 0 ? "Source-backed" : "No evidence"} />
          <Metric label="Exceptions" value={`${unresolved}`} tone={unresolved ? "review" : "healthy"} />
        </div>
        <div className={styles.policyControls}>
          <fieldset><legend>Allocation rule</legend><div className={styles.segmented}>{(["verified_activity", "equal_recipients", "hybrid"] as const).map((value) => <button data-action-id="program.update_policy" data-testid={`policy-allocation-${value}`} key={value} type="button" aria-pressed={allocationRule === value} onClick={() => setAllocationRule(value)}>{humanize(value)}</button>)}</div></fieldset>
          <fieldset><legend>Eligibility</legend><div className={styles.segmented}>{(["resolved_only", "manual_review"] as const).map((value) => <button data-action-id="program.update_policy" data-testid={`policy-eligibility-${value}`} key={value} type="button" aria-pressed={eligibilityMode === value} onClick={() => setEligibilityMode(value)}>{humanize(value)}</button>)}</div></fieldset>
        </div>
        <div className={styles.inlineActions}>
          <button data-action-id="program.update_policy" data-testid={`policy-save-${program.id}`} type="button" className={styles.primaryButton} disabled={saving} title={saving ? "This policy version is being saved" : undefined} onClick={() => void savePolicyVersion()}>{saving ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Save policy version</button>
          <Link data-action-id="program.simulate" data-testid={`policy-simulate-${program.id}`} href={`/mission?community=${encodeURIComponent(slug)}&program=${encodeURIComponent(program.missionId ?? program.id)}&mode=simulate`} className={styles.secondaryButton}>Generate simulation in Mission <ArrowUpRight /></Link>
        </div>
      </div>
    </details>
  );
}

function SourcesTab({ slug, surface, connected, onRefresh }: { slug: string; surface: CommunitySurface; connected: boolean; onRefresh: () => void }) {
  return (
    <section className={styles.tabPanel}>
      <div className={styles.tabIntro}>
        <div><p className={styles.sectionKicker}>Evidence infrastructure</p><h2>Sources</h2><p>Connection, synchronization, and operational health for every configured evidence source.</p></div>
        <Link data-action-id="source.connect" data-testid="sources-manage-connections" href={profileConnectPath(`/communities/${slug}`)} className={styles.secondaryButton}>Manage connections <ArrowUpRight /></Link>
      </div>
      <div className={styles.sourceList}>
        {surface.health.connectorStatus.map((source) => {
          const healthy = ["healthy", "connected", "live"].includes(source.health.toLowerCase());
          const programs = surface.programs.filter((program) => program.rules.connectorId === source.id).map((program) => program.name);
          return (
            <article key={source.id} className={styles.sourceRecord}>
              <span className={styles.sourceIcon}><Radio /></span>
              <div><h3>{humanize(source.label || source.id)}</h3><p>{source.accountLabel ?? "Evidence connector"}</p></div>
              <dl>
                <div><dt>Health</dt><dd data-tone={healthy ? "healthy" : "review"}>{humanize(source.health)}</dd></div>
                <div><dt>Sync state</dt><dd>{source.currentSyncState ? humanize(source.currentSyncState) : "No normalized run"}</dd></div>
                <div><dt>Last successful sync</dt><dd>{source.lastSuccessfulSync ? new Date(source.lastSuccessfulSync).toLocaleString() : surface.health.lastScrobbleAt ? new Date(surface.health.lastScrobbleAt).toLocaleString() : "No sync recorded"}</dd></div>
                <div><dt>Records observed</dt><dd>{source.recordsObserved ?? 0}</dd></div>
                <div><dt>Programs using source</dt><dd>{programs.join(", ") || "No program"}</dd></div>
                <div><dt>Authentication</dt><dd>{source.authExpiresAt ? `Expires ${new Date(source.authExpiresAt).toLocaleDateString()}` : "Managed in Profile"}</dd></div>
              </dl>
              <details className={styles.sourceDetails}>
                <summary>Technical details</summary>
                <div><code>{source.connectionId ?? "legacy-connector"}</code><span>Cached snapshot: {source.cachedAt ? new Date(source.cachedAt).toLocaleString() : "not recorded"}</span></div>
              </details>
            </article>
          );
        })}
      </div>
      <div className={styles.sensorWorkspace}><CommunitySensorPanel slug={slug} installed={connected} onSynced={onRefresh} /><CommunityBridgePanel communitySlug={slug} onSynced={onRefresh} /></div>
      <button data-action-id="community.refresh" data-testid="community-refresh-state" type="button" className={styles.tertiaryButton} onClick={onRefresh}><RefreshCw /> Refresh console state</button>
    </section>
  );
}

function ActivityRows({ timeline }: { timeline: CommunitySurface["timeline"] }) {
  if (!timeline.length) return <p className={styles.emptyInline}>No operational events have been recorded yet.</p>;
  return <ol className={styles.activityList}>{timeline.map((event) => { const Icon = eventIcon(event.eventType); return <li key={event.id}><span><Icon /></span><div><strong>{event.title}</strong>{event.detail && <p>{event.detail}</p>}</div><time>{new Date(event.createdAt).toLocaleString()}</time></li>; })}</ol>;
}

function ActivityTab({ timeline }: { timeline: CommunitySurface["timeline"] }) {
  return <section className={styles.tabPanel}><div className={styles.tabIntro}><div><p className={styles.sectionKicker}>Chronological record</p><h2>Operations ledger</h2><p>Real source, policy, authorization, and settlement events for this community.</p></div><span className={styles.ledgerCount}><Clock3 />{timeline.length} events</span></div><div className={styles.ledgerPanel}><ActivityRows timeline={timeline} /></div></section>;
}
