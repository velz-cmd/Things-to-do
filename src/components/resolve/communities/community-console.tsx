"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  UserRoundSearch,
  UsersRound,
  WalletCards,
} from "lucide-react";
import clsx from "clsx";
import { CommunitySensorPanel } from "@/components/resolve/communities/community-sensor-panel";
import { CommunityBridgePanel } from "@/components/resolve/communities/community-bridge-panel";
import { PROGRAM_TEMPLATES } from "@/lib/communities/catalog";
import type { CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { CommunitySurface, ProgramRecord } from "@/lib/communities/types";
import { profileConnectPath } from "@/lib/communities/community-nav";
import { communityLinkedViaProfile } from "@/lib/discover/community-profile-link";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { CommunityDomainIcon, communityOperationsDescription } from "./community-identity";
import styles from "./communities.module.css";

type ConsoleTab = "overview" | "programs" | "obligations" | "identities" | "sources" | "activity";

const TABS: Array<{ id: ConsoleTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "programs", label: "Programs" },
  { id: "obligations", label: "Obligations" },
  { id: "identities", label: "Identity Desk" },
  { id: "sources", label: "Sources" },
  { id: "activity", label: "Activity" },
];

const PENDING_STATUSES = new Set(["authorized", "pending_funding"]);

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
  const authorizations = surface.authorizations ?? [];
  const readiness = surface.deployReadiness;
  const identityResolved = readiness?.walletMappedCount ?? 0;
  const identityUnresolved = Math.max(0, (readiness?.authorizedCount ?? 0) - identityResolved);
  const connectorHealthy = surface.health.connectorStatus.filter((source) => ["healthy", "connected", "live"].includes(source.health.toLowerCase())).length;
  const pendingAuthorizations = authorizations.filter((item) => PENDING_STATUSES.has(item.status));
  const visibleAuthorizations = obligationsFilter === "pending" ? pendingAuthorizations : authorizations;
  const activePrograms = programs.filter((program) => ["active", "deployed"].includes(program.status)).length;

  useEffect(() => {
    setTab(initialTab);
    const hash = window.location.hash;
    if (hash === "#settlement-readiness") setTab("overview");
    if (hash === "#obligations") setTab("obligations");
    if (hash === "#programs") setTab("programs");
  }, [initialTab]);

  const recommended = useMemo(() => {
    if (!sourcesConnected) {
      return {
        eyebrow: "Connection required",
        title: `Connect ${catalog.upstream.split(" · ")[0]} as an evidence source.`,
        why: "The community cannot synchronize activity or recognize obligations until a source identity is connected.",
        result: "Verified source events become available to program policy.",
        action: "Connect source",
        href: profileConnectPath(`/communities/${slug}`),
      };
    }
    if (programs.length === 0) {
      return {
        eyebrow: "Policy required",
        title: "Create the first operating program.",
        why: "Evidence is available, but no policy currently converts verified activity into obligations.",
        result: "Eligible evidence can be recognized under a reviewable rule.",
        action: "Create program",
        onClick: onRequestCreateProgram,
      };
    }
    if (identityUnresolved > 0) {
      return {
        eyebrow: "Identity review",
        title: `Resolve ${identityUnresolved} unmatched payout ${identityUnresolved === 1 ? "identity" : "identities"}.`,
        why: "Unmatched identities cannot receive a settlement until a payout destination is confirmed.",
        result: `${readiness?.authorizedCount ?? 0} recognized payees can move toward settlement review.`,
        action: "Open Identity Desk",
        onClick: () => setTab("identities"),
      };
    }
    if ((readiness?.pendingObligationsUsd ?? 0) > 0) {
      return {
        eyebrow: readiness?.canDeploy ? "Settlement package ready" : "Operational review",
        title: readiness?.canDeploy ? "Review the settlement package before Capital authorization." : "Review recognized obligations and current blockers.",
        why: readiness?.reasons?.[0] ?? "Recognized obligations must pass identity, policy, simulation, and capital checks.",
        result: "A controlled handoff to Mission or Capital with community context preserved.",
        action: readiness?.canDeploy ? "Open Capital" : "Review obligations",
        href: readiness?.canDeploy ? `/capital?community=${encodeURIComponent(slug)}` : undefined,
        onClick: readiness?.canDeploy ? undefined : () => setTab("obligations"),
      };
    }
    return {
      eyebrow: "Operational health",
      title: "Synchronize sources for the next evidence cycle.",
      why: "Programs are configured and no recognized obligations currently require review.",
      result: "Fresh source activity is evaluated against active policy.",
      action: "Open Sources",
      onClick: () => setTab("sources"),
    };
  }, [catalog.upstream, identityUnresolved, onRequestCreateProgram, programs.length, readiness, slug, sourcesConnected]);

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
            {!recommended.href && <button type="button" className={styles.primaryButton} onClick={() => recommended.onClick?.()}><Sparkles /> {recommended.action}</button>}
            {recommended.href && <Link href={recommended.href} className={styles.primaryButton}><ArrowRight /> {recommended.action}</Link>}
            <Link href={`/mission?community=${slug}`} className={styles.secondaryButton}>Run Mission <ArrowUpRight /></Link>
            <details className={styles.moreMenu}><summary aria-label="More community actions"><MoreHorizontal /></summary><div><Link href={profileConnectPath(`/communities/${slug}`)}>Manage connections</Link><Link href={`/discover?community=${slug}`}>View in Discover</Link></div></details>
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
              <MapNode icon={Route} label="Settlement" value={readiness?.canDeploy ? "Ready" : "Blocked"} tone={readiness?.canDeploy ? "healthy" : "review"} onClick={() => document.getElementById("settlement-readiness")?.scrollIntoView({ behavior: "smooth" })} />
            </div>
          </section>

          <section className={styles.overviewGrid}>
            <div className={styles.recommendedPanel}>
              <p className={styles.sectionKicker}>Next operation · {recommended.eyebrow}</p>
              <h2>{recommended.title}</h2>
              <dl><div><dt>Why</dt><dd>{recommended.why}</dd></div><div><dt>Expected result</dt><dd>{recommended.result}</dd></div></dl>
              <div className={styles.inlineActions}>
                {recommended.href ? <Link href={recommended.href} className={styles.primaryButton}>{recommended.action}<ArrowRight /></Link> : <button type="button" className={styles.primaryButton} onClick={recommended.onClick}>{recommended.action}<ArrowRight /></button>}
                <Link href={`/mission?community=${slug}`} className={styles.secondaryButton}>Run Mission analysis</Link>
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

          <SettlementReadiness slug={slug} surface={surface} unresolved={identityUnresolved} onTab={openTab} />

          <section className={styles.bottomGrid}>
            <div className={styles.ledgerPanel}><div className={styles.panelHeading}><div><p className={styles.sectionKicker}>Recent operations</p><h2>Activity ledger</h2></div><button type="button" onClick={() => openTab("activity")}>View all</button></div><ActivityRows timeline={surface.timeline.slice(0, 4)} /></div>
            <div className={styles.attentionPanel}><p className={styles.sectionKicker}>Attention items</p><h2>Operational blockers</h2>{readiness?.reasons?.length ? <ul>{readiness.reasons.map((reason) => <li key={reason}><CircleAlert />{reason}</li>)}</ul> : <p className={styles.cleanState}><CheckCircle2 /> No current blockers in the settlement-readiness model.</p>}</div>
          </section>
        </div>
      )}

      {tab === "programs" && <ProgramsTab slug={slug} programs={programs} busy={busy} onCreate={onRequestCreateProgram} />}
      {tab === "obligations" && <ObligationsTab slug={slug} authorizations={visibleAuthorizations} filter={obligationsFilter} onFilter={onObligationsFilterChange} />}
      {tab === "identities" && <IdentityDesk slug={slug} authorizations={authorizations} />}
      {tab === "sources" && <SourcesTab slug={slug} surface={surface} connected={sourcesConnected} onRefresh={onRefresh} />}
      {tab === "activity" && <ActivityTab timeline={surface.timeline} />}
    </div>
  );
}

function MapNode({ icon: Icon, label, value, tone, onClick }: { icon: LucideIcon; label: string; value: string; tone: string; onClick: () => void }) {
  return <button type="button" className={styles.mapNode} data-tone={tone} onClick={onClick}><Icon /><span>{label}</span><strong>{value}</strong></button>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className={styles.metric}><span>{label}</span><strong data-tone={tone}>{value}</strong></div>;
}

function SettlementReadiness({ slug, surface, unresolved, onTab }: { slug: string; surface: CommunitySurface; unresolved: number; onTab: (tab: ConsoleTab) => void }) {
  const readiness = surface.deployReadiness;
  const simulationComplete = surface.timeline.some((event) => event.eventType.toLowerCase().includes("simulat"));
  return (
    <section id="settlement-readiness" className={styles.settlementDesk}>
      <div className={styles.panelHeading}><div><p className={styles.sectionKicker}>Capital handoff</p><h2>Settlement Readiness Desk</h2></div><span data-state={readiness.canDeploy ? "ready" : "review"}>{readiness.canDeploy ? "Ready" : "Blocked"}</span></div>
      <div className={styles.readinessGrid}>
        <Metric label="Programs" value={`${surface.programs.length} configured`} />
        <Metric label="Obligations" value={`${readiness.authorizedCount} recognized`} />
        <Metric label="Identities" value={unresolved ? `${unresolved} unresolved` : `${readiness.walletMappedCount} resolved`} tone={unresolved ? "review" : "healthy"} />
        <Metric label="Policy" value={surface.programs.length ? "Configured" : "Required"} />
        <Metric label="Simulation" value={simulationComplete ? "Completed" : "Not completed"} tone={simulationComplete ? "healthy" : "review"} />
        <Metric label="Capital" value={readiness.fundingGapUsd > 0 ? "Required" : "Available"} tone={readiness.fundingGapUsd > 0 ? "review" : "healthy"} />
      </div>
      <div className={styles.readinessActions}>
        {unresolved > 0 && <button type="button" onClick={() => onTab("identities")}><Fingerprint /> Resolve identities</button>}
        {!simulationComplete && <Link href={`/mission?community=${slug}`}><Gauge /> Run simulation in Mission</Link>}
        {readiness.fundingGapUsd > 0 && <Link href={`/capital?community=${slug}`}><WalletCards /> Open Capital</Link>}
        {readiness.canDeploy && <Link href={`/capital?community=${slug}`} className={styles.cardPrimary}>Review authorization <ArrowRight /></Link>}
      </div>
    </section>
  );
}

function ProgramsTab({ slug, programs, busy, onCreate }: { slug: string; programs: ProgramRecord[]; busy: boolean; onCreate: () => void }) {
  return (
    <section className={styles.tabPanel}>
      <div className={styles.tabIntro}><div><p className={styles.sectionKicker}>Policy operations</p><h2>Programs</h2><p>Programs convert verified evidence into recognized obligations. Capital requirements are handed to Capital.</p></div><button type="button" className={styles.primaryButton} onClick={onCreate} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <GitMerge />} Create program</button></div>
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
          {readiness && readiness.fundingGapUsd > 0 && <div className={styles.capitalRequirement}><span><WalletCards /> Capital requirement</span><strong>${readiness.fundingGapUsd.toFixed(2)} required before settlement</strong><Link href={`/capital?community=${slug}&program=${program.id}`}>Open Capital <ArrowUpRight /></Link></div>}
          <div className={styles.inlineActions}><Link href={`/mission?community=${slug}&program=${program.missionId ?? program.id}`} className={styles.secondaryButton}>Review policy</Link><Link href={`/mission?community=${slug}&program=${program.missionId ?? program.id}&mode=simulate`} className={styles.secondaryButton}>Simulate in Mission</Link></div>
        </article>;
      })}</div> : <div className={styles.emptyState}><BookOpenCheck /><p>No operating policy exists yet. Create a draft program to evaluate verified evidence.</p><button type="button" onClick={onCreate}>Create program</button></div>}
    </section>
  );
}

function ObligationsTab({ slug, authorizations, filter, onFilter }: { slug: string; authorizations: CommunitySurface["authorizations"]; filter: "all" | "pending"; onFilter: (filter: "all" | "pending") => void }) {
  return <section className={styles.tabPanel}><div className={styles.tabIntro}><div><p className={styles.sectionKicker}>Recognition ledger</p><h2>Obligations</h2><p>Evidence-backed value awaiting identity, policy, or settlement operations.</p></div><div className={styles.segmented}>{(["all", "pending"] as const).map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => onFilter(item)}>{humanize(item)}</button>)}</div></div>{authorizations.length ? <div className={styles.tableWrap}><table><thead><tr><th>Payee</th><th>Evidence</th><th>Recognized value</th><th>Identity</th><th>Settlement status</th><th>Action</th></tr></thead><tbody>{authorizations.map((item) => <tr key={item.id}><td><strong>{item.contextLabel ?? item.payeeKey}</strong><span>{item.payeeKey}</span></td><td>{item.payeeKeyType ? humanize(item.payeeKeyType) : "Verified source record"}</td><td>${item.amountUsd.toFixed(2)}</td><td><span className={styles.tableStatus} data-state={item.entityId ? "healthy" : "review"}>{item.entityId ? "Resolved" : "Needs identity"}</span></td><td>{humanize(item.status)}</td><td>{item.entityPath ? <Link href={item.entityPath}>View evidence</Link> : <Link href={profileConnectPath(`/communities/${slug}`)}>Resolve identity</Link>}</td></tr>)}</tbody></table></div> : <div className={styles.emptyState}><ScrollText /><p>No obligation records match this view. Synchronize sources to evaluate new evidence.</p><Link href={profileConnectPath(`/communities/${slug}`)}>Manage sources</Link></div>}</section>;
}

function IdentityDesk({ slug, authorizations }: { slug: string; authorizations: CommunitySurface["authorizations"] }) {
  const identities = Array.from(new Map(authorizations.map((item) => [item.payeeKey, item])).values());
  return <section className={styles.tabPanel}><div className={styles.tabIntro}><div><p className={styles.sectionKicker}>Communities-native resolution</p><h2>Identity Resolution Desk</h2><p>Review observed source identities before obligations can reach a payout destination.</p></div><Link href={profileConnectPath(`/communities/${slug}`)} className={styles.secondaryButton}>Link payout identity <ArrowUpRight /></Link></div>{identities.length ? <div className={styles.tableWrap}><table><thead><tr><th>Observed identity</th><th>Suggested match</th><th>Evidence</th><th>Status</th><th>Actions</th></tr></thead><tbody>{identities.map((item) => <tr key={item.payeeKey}><td><strong>{item.contextLabel ?? item.payeeKey}</strong><span>{item.payeeKeyType ? humanize(item.payeeKeyType) : "Source identity"}</span></td><td>{item.entityId ?? "No verified match"}</td><td>${item.amountUsd.toFixed(2)} recognized</td><td><span className={styles.tableStatus} data-state={item.entityId ? "healthy" : "review"}>{item.entityId ? "Resolved" : "Review"}</span></td><td><div className={styles.tableActions}>{item.entityPath && <Link href={item.entityPath}>Open evidence</Link>}<Link href={profileConnectPath(`/communities/${slug}`)}>{item.entityId ? "Link payout" : "Resolve"}</Link></div></td></tr>)}</tbody></table></div> : <div className={styles.emptyState}><UserRoundSearch /><p>No observed identities are waiting for resolution. New identities appear after source synchronization recognizes obligations.</p><Link href={profileConnectPath(`/communities/${slug}`)}>Manage connections</Link></div>}</section>;
}

function SourcesTab({ slug, surface, connected, onRefresh }: { slug: string; surface: CommunitySurface; connected: boolean; onRefresh: () => void }) {
  return <section className={styles.tabPanel}><div className={styles.tabIntro}><div><p className={styles.sectionKicker}>Evidence infrastructure</p><h2>Sources</h2><p>Connection, synchronization, and operational health for every configured evidence source.</p></div><Link href={profileConnectPath(`/communities/${slug}`)} className={styles.secondaryButton}>Manage connections <ArrowUpRight /></Link></div><div className={styles.sourceList}>{surface.health.connectorStatus.map((source) => <article key={source.id} className={styles.sourceRecord}><span className={styles.sourceIcon}><Radio /></span><div><h3>{humanize(source.label || source.id)}</h3><p>Evidence connector</p></div><dl><div><dt>Status</dt><dd data-tone={["healthy", "connected", "live"].includes(source.health.toLowerCase()) ? "healthy" : "review"}>{humanize(source.health)}</dd></div><div><dt>Last sync</dt><dd>{surface.health.lastScrobbleAt ? new Date(surface.health.lastScrobbleAt).toLocaleString() : "No sync recorded"}</dd></div><div><dt>Used by</dt><dd>{surface.programs.filter((program) => program.rules.connectorId === source.id).map((program) => program.name).join(", ") || "No program"}</dd></div></dl></article>)}</div><div className={styles.sensorWorkspace}><CommunitySensorPanel slug={slug} installed={connected} onSynced={onRefresh} /><CommunityBridgePanel communitySlug={slug} onSynced={onRefresh} /></div><button type="button" className={styles.tertiaryButton} onClick={onRefresh}><RefreshCw /> Refresh console state</button></section>;
}

function ActivityRows({ timeline }: { timeline: CommunitySurface["timeline"] }) {
  if (!timeline.length) return <p className={styles.emptyInline}>No operational events have been recorded yet.</p>;
  return <ol className={styles.activityList}>{timeline.map((event) => { const Icon = eventIcon(event.eventType); return <li key={event.id}><span><Icon /></span><div><strong>{event.title}</strong>{event.detail && <p>{event.detail}</p>}</div><time>{new Date(event.createdAt).toLocaleString()}</time></li>; })}</ol>;
}

function ActivityTab({ timeline }: { timeline: CommunitySurface["timeline"] }) {
  return <section className={styles.tabPanel}><div className={styles.tabIntro}><div><p className={styles.sectionKicker}>Chronological record</p><h2>Operations ledger</h2><p>Real source, policy, authorization, and settlement events for this community.</p></div><span className={styles.ledgerCount}><Clock3 />{timeline.length} events</span></div><div className={styles.ledgerPanel}><ActivityRows timeline={timeline} /></div></section>;
}
