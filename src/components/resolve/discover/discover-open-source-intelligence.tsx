"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowRight, BadgeCheck, BookOpenCheck, Boxes, CheckCircle2,
  CircleAlert, CircleDollarSign, Clock3, ExternalLink, FileCode2, GitBranch, GitFork,
  GitPullRequest, Landmark, Network, ScanSearch, ShieldCheck, Sparkles, Users, WalletCards,
  Cable, Database, Link2, Route, Scale,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import type { DiscoverOssIntelligence, DiscoverRepositoryChange } from "@/lib/discover/oss-intelligence";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import styles from "./discover-open-source-intelligence.module.css";

const number = new Intl.NumberFormat("en-US");
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  timeZone: "UTC", timeZoneName: "short",
});

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not available" : date.format(parsed);
}

function ChangeValue({ row }: { row: DiscoverRepositoryChange }) {
  if (row.delta === null) return <span className={styles.baselineValue}>Baseline</span>;
  const direction = row.delta > 0 ? "+" : "";
  return <span className={row.delta === 0 ? styles.steadyValue : row.delta > 0 ? styles.upValue : styles.downValue}>{direction}{number.format(row.delta)} {row.unit}</span>;
}

function StatusDot({ state }: { state: "covered" | "uncovered" | "no_activity" }) {
  return <span className={`${styles.statusDot} ${styles[`status_${state}`]}`}>{state === "covered" ? "Covered" : state === "uncovered" ? "Recognition gap" : "No activity"}</span>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function PoolProgress({ value }: { value: number }) {
  return <div className={styles.poolProgress} aria-label={`${number.format(value)} percent funded toward the next checkpoint`}><i style={{ width: `${value}%` }} /></div>;
}

function SupporterLedger({
  data,
  signedIn,
  onSignIn,
}: {
  data: DiscoverOssIntelligence;
  signedIn: boolean;
  onSignIn: () => void;
}) {
  return (
    <section className={styles.supportSection}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionKicker}>My support and benefits</p>
          <h2>Confirmed deposits and community-defined benefits</h2>
          <p>Benefits are persisted only after the deposit and activation condition are confirmed. They are non-financial unless a separate policy says otherwise.</p>
        </div>
        {!signedIn && <button type="button" data-action-id="auth.open_sign_in" onClick={onSignIn} className={styles.secondaryButton}>Sign in to view support</button>}
      </div>
      {signedIn ? (
        <div className={styles.supportGrid}>
          <div>
            <h3>Deposits</h3>
            {data.viewerSupport.deposits.length > 0 ? data.viewerSupport.deposits.map((deposit) => (
              <article key={deposit.stakeId}>
                <div><strong>{deposit.programName}</strong><span>{deposit.status.replaceAll("_", " ")}</span></div>
                <p>{usd.format(deposit.amountUsd)} deposited · {formatDate(deposit.createdAt)}</p>
              </article>
            )) : <p className={styles.truthEmpty}>No confirmed or pending community-pool deposit is recorded for this account.</p>}
          </div>
          <div>
            <h3>Benefit ledger</h3>
            {data.viewerSupport.benefits.length > 0 ? data.viewerSupport.benefits.map((benefit) => (
              <article key={benefit.id}>
                <div><strong>{benefit.label}</strong><span>{benefit.status}</span></div>
                <p>{benefit.activationCheckpointUsd === null ? "Activated by confirmed deposit" : `Activates at ${usd.format(benefit.activationCheckpointUsd)} checkpoint`}</p>
                {benefit.expiresAt && <small>Expires {formatDate(benefit.expiresAt)}</small>}
                {benefit.limitations.length > 0 && <small>{benefit.limitations.join(" · ")}</small>}
              </article>
            )) : <p className={styles.truthEmpty}>No community-defined supporter benefit is recorded. A deposit never creates an invented reward.</p>}
          </div>
        </div>
      ) : <p className={styles.truthEmpty}>Sign in to read your persisted pool deposits and supporter-benefit history.</p>}
    </section>
  );
}

function AttributionPanel({ data }: { data: DiscoverOssIntelligence }) {
  const repository = data.selected?.fullName ?? "repository";
  return (
    <section className={styles.attributionSection}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionKicker}>Proof and attribution graph</p>
          <h2>Who created value and where policy routes it</h2>
          <p>Every relationship below is derived from the selected snapshot, active policy, persisted pool records, or confirmed receipts.</p>
        </div>
        <span className={styles.persistedBadge}><Database /> {data.proof.persistedEvents} persisted proof {data.proof.persistedEvents === 1 ? "event" : "events"}</span>
      </div>
      <div className={styles.graphSummary}>
        <Metric label="Source" value={data.proof.source} detail={data.proof.verificationState.replaceAll("_", " ")} />
        <Metric label="Uncovered proof" value={number.format(data.recognitionSummary.uncoveredEvents)} detail={`${data.recognitionSummary.contributorCount} attributed contributors`} />
        <Metric label="Graph records" value={number.format(data.attributionGraph.nodes.length)} detail={`${data.attributionGraph.edges.length} reproducible relationships`} />
        <Metric label="Dependencies" value={number.format(data.dependencies.length)} detail="Detected from the repository manifest" />
      </div>
      <div className={styles.graphBody}>
        <div className={styles.graphEdges}>
          {data.attributionGraph.edges.slice(0, 18).map((edge, index) => {
            const from = data.attributionGraph.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
            const to = data.attributionGraph.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
            return <div key={`${edge.from}:${edge.to}:${index}`}><span>{from}</span><Route aria-hidden="true" /><strong>{edge.relation}</strong><ArrowRight aria-hidden="true" /><span>{to}</span></div>;
          })}
          {data.attributionGraph.edges.length === 0 && <p className={styles.truthEmpty}>No attribution relationship is available for this snapshot.</p>}
        </div>
        <div className={styles.dependencyList}>
          <h3>Upstream dependency evidence</h3>
          {data.dependencies.length > 0 ? data.dependencies.slice(0, 12).map((dependency) => (
            <article key={dependency.name}>
              <div><Link2 aria-hidden="true" /><strong>{dependency.name}</strong><span>{dependency.requirement}</span></div>
              <p>{dependency.kind} dependency in a verified manifest. Maintainer identity is unresolved.</p>
              {dependency.splitPercent > 0 && <small>{dependency.splitPercent}% dependency-support policy applies only after maintainer identity and payout readiness are verified.</small>}
              <a href={dependency.sourceUrl} target="_blank" rel="noreferrer" data-action-id="discover.open_evidence">Manifest proof <ExternalLink /></a>
            </article>
          )) : <p className={styles.truthEmpty}>No supported dependency manifest was captured for {repository}. No dependency split is inferred.</p>}
        </div>
      </div>
      <details className={styles.evidenceDetails}>
        <summary>Evidence details</summary>
        <dl><div><dt>Snapshot ID</dt><dd>{data.proof.snapshotId ?? "Not available"}</dd></div><div><dt>Observed</dt><dd>{formatDate(data.proof.observedAt)}</dd></div><div><dt>Calculation</dt><dd>{data.recognitionSummary.calculationMethod}</dd></div></dl>
      </details>
    </section>
  );
}

export function DiscoverOpenSourceIntelligence({ initialData }: { initialData: DiscoverOssIntelligence }) {
  const router = useRouter();
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const { state: connections, loading: connectionsLoading } = useUserConnections();
  const [repository, setRepository] = useState(initialData.selected?.fullName ?? "");
  const [pending, setPending] = useState<"snapshot" | "mission" | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const selected = initialData.selected;
  const github = connections.platforms.find((platform) => platform.id === "github");
  const githubUsername = connections.githubUsername?.toLowerCase() ?? null;
  const connectedRepositories = githubUsername
    ? initialData.repositories.filter((option) => option.owner.toLowerCase() === githubUsername)
    : [];

  async function captureSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = repository.trim();
    if (!target) {
      setMessage({ kind: "error", text: "Enter a public GitHub repository as owner/repository." });
      return;
    }
    if (!user) {
      openSignIn();
      return;
    }
    setPending("snapshot");
    setMessage(null);
    try {
      const response = await fetch("/api/discover/oss-snapshots", {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ repository: target }),
      });
      const body = await response.json() as { ok?: boolean; repository?: string; error?: string };
      if (!response.ok || !body.ok || !body.repository) throw new Error(body.error ?? "The repository snapshot could not be captured.");
      setMessage({ kind: "success", text: `Verified snapshot persisted for ${body.repository}.` });
      router.push(`/discover?repo=${encodeURIComponent(body.repository)}`);
      router.refresh();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "The repository snapshot could not be captured." });
    } finally {
      setPending(null);
    }
  }

  async function startMission() {
    if (!selected) return;
    if (!user) {
      openSignIn();
      return;
    }
    if (!selected.snapshotPersisted) {
      setMessage({ kind: "error", text: "Capture a current persisted snapshot before opening this decision in Mission." });
      return;
    }
    setPending("mission");
    setMessage(null);
    try {
      const returnTo = `/discover?repo=${selected.fullName}`;
      const response = await fetch("/api/discover/oss-missions", {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repository: selected.fullName,
          fingerprint: selected.fingerprint,
          objective: `Decide how active programs should recognize and fund accepted work in ${selected.fullName}.`,
          evidenceIds: initialData.recognitionDebt.slice(0, 50).map((record) => record.id),
          returnTo,
        }),
      });
      const body = await response.json() as { ok?: boolean; destination?: string; error?: string };
      if (!response.ok || !body.ok || !body.destination) throw new Error(body.error ?? "Mission could not be created.");
      router.push(body.destination);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Mission could not be created." });
      setPending(null);
    }
  }

  function selectRepository(value: string) {
    setRepository(value);
    if (value) router.push(`/discover?repo=${encodeURIComponent(value)}`);
  }

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><GitBranch aria-hidden="true" /> Proof-to-Pool economic intelligence</div>
            <h1>See which work your ecosystem depends on, what funding misses, and how shared capital reaches contributors.</h1>
            <p>RESOLVE turns existing activity into verified proof, attribution, policy coverage, communal funding milestones, automatic distribution, and public receipts.</p>
            <div className={styles.entryPaths} aria-label="Choose a Discover path">
              <a href="#connected-ecosystem" data-action-id="discover.use_connected_ecosystem" className={styles.entryPath}>
                <Cable aria-hidden="true" />
                <span>Use my connected ecosystem</span>
                <small>{connectionsLoading ? "Reading Profile connection" : github?.connected ? `Connected ${github.displayValue ?? "GitHub"}` : "Connect once in Profile"}</small>
              </a>
              <a href="#public-repository-analysis" data-action-id="discover.open_public_repository_analysis" className={styles.entryPath}>
                <ScanSearch aria-hidden="true" />
                <span>Analyze a public repository</span>
                <small>Capture verified GitHub activity</small>
              </a>
              <a href="#community-pools" data-action-id="discover.browse_community_pools" className={styles.entryPath}>
                <Landmark aria-hidden="true" />
                <span>Browse community pools</span>
                <small>{initialData.pools.length} active persisted {initialData.pools.length === 1 ? "pool" : "pools"}</small>
              </a>
            </div>
            <form id="public-repository-analysis" className={styles.repoForm} data-action-id="discover.capture_repository_snapshot" onSubmit={captureSnapshot}>
              <label htmlFor="discover-repository">Public GitHub repository</label>
              <div className={styles.repoControls}>
                <div className={styles.repoInputWrap}>
                  <GitFork aria-hidden="true" />
                  <input id="discover-repository" data-action-id="discover.capture_repository_snapshot" value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="owner/repository" autoComplete="off" spellCheck={false} />
                </div>
                <button type="submit" data-action-id="discover.capture_repository_snapshot" disabled={pending !== null} className={styles.primaryButton}>
                  <ScanSearch aria-hidden="true" />
                  {pending === "snapshot" ? "Capturing…" : selected?.fullName === repository && selected.snapshotPersisted ? "Refresh snapshot" : "Analyze repository"}
                </button>
              </div>
            </form>
            {message && <p className={`${styles.actionMessage} ${message.kind === "error" ? styles.errorMessage : styles.successMessage}`} role="status">{message.text}</p>}
          </div>

          <div className={styles.compiler} aria-label="Repository funding intelligence workflow">
            <div className={styles.compilerGrid} aria-hidden="true" />
            <div className={styles.sourceStack}>
              <span><GitPullRequest /> Pull requests</span><span><BookOpenCheck /> Documentation</span><span><ShieldCheck /> Security</span>
            </div>
            <div className={styles.flowLine}><i /><i /><i /></div>
            <div className={styles.resolveNode}><Network /><strong>RESOLVE</strong><small>verified snapshot</small></div>
            <ArrowRight className={styles.flowArrow} aria-hidden="true" />
            <div className={styles.decisionStack}><span><Boxes /> Coverage</span><span><CircleAlert /> Debt</span><span><Landmark /> Funding</span></div>
          </div>
        </header>

        <section id="connected-ecosystem" className={styles.connectionSection}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionKicker}>Profile connection state</p>
              <h2>Your connected ecosystem</h2>
              <p>Discover reads the canonical connection saved in Profile. It never creates a second GitHub connection.</p>
            </div>
            {github?.connected
              ? <span className={styles.persistedBadge}><BadgeCheck /> Connected {github.displayValue ?? "GitHub"}</span>
              : <Link href="/profile?view=sources&returnTo=/discover" data-action-id="profile.connect_source" className={styles.secondaryButton}>Connect in Profile <ArrowRight /></Link>}
          </div>
          {github?.connected ? (
            connectedRepositories.length > 0 ? (
              <div className={styles.connectedRepoGrid}>
                {connectedRepositories.map((option) => (
                  <button key={option.fullName} type="button" data-action-id="discover.select_repository" onClick={() => selectRepository(option.fullName)}>
                    <FileCode2 aria-hidden="true" />
                    <span>{option.fullName}</span>
                    <small>Persisted snapshot · {formatDate(option.scannedAt)}</small>
                  </button>
                ))}
              </div>
            ) : <p className={styles.truthEmpty}>GitHub is connected in Profile, but no persisted repository snapshot belongs to this account yet. Analyze a public repository below to create the first one.</p>
          ) : <p className={styles.truthEmpty}>No GitHub connection is saved in Profile. Public repository analysis remains available without creating a duplicate connection.</p>}
        </section>

        {!selected ? (
          <>
            <section className={styles.emptyState}>
              <ScanSearch aria-hidden="true" />
              <div><p className={styles.sectionKicker}>No persisted repository snapshot</p><h2>Start with a real public repository.</h2><p>Analysis appears only after GitHub returns a repository and RESOLVE persists its verified activity snapshot. No sample results are shown as live data.</p></div>
            </section>
            <section id="community-pools" className={styles.poolSection}>
              <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Community pools</p><h2>Browse shared capital already attached to active policy</h2></div></div>
              {initialData.pools.length > 0 ? <div className={styles.compactPoolGrid}>{initialData.pools.map((pool) => <article key={pool.programId}><div><strong>{pool.programName}</strong><span>{pool.communitySlug}</span></div><p>{pool.rationale}</p><dl><div><dt>Confirmed</dt><dd>{usd.format(pool.poolBalanceUsd)}</dd></div><div><dt>Next checkpoint</dt><dd>{pool.nextCheckpointUsd === null ? "Complete" : usd.format(pool.nextCheckpointUsd)}</dd></div></dl><Link href={pool.fundingHref} data-action-id="capital.open_funding">Open pool <ArrowRight /></Link></article>)}</div> : <p className={styles.truthEmpty}>No active community pool exists yet. Discover will not create a sample pool.</p>}
            </section>
            <SupporterLedger data={initialData} signedIn={Boolean(user)} onSignIn={openSignIn} />
          </>
        ) : (
          <>
            <section className={styles.contextBar} aria-label="Selected repository context">
              <div className={styles.repoIdentity}><span className={styles.repoMark}><FileCode2 /></span><div><span>Selected repository</span><strong>{selected.fullName}</strong></div></div>
              <label className={styles.selectorLabel} htmlFor="discover-repository-select">Repository
                <select id="discover-repository-select" data-action-id="discover.select_repository" value={selected.fullName} onChange={(event) => selectRepository(event.target.value)}>
                  {initialData.repositories.map((option) => <option key={option.fullName} value={option.fullName}>{option.fullName}</option>)}
                </select>
              </label>
              <div className={styles.contextFacts}>
                <span><strong>{number.format(selected.stars)}</strong> stars</span><span><strong>{number.format(selected.forks)}</strong> forks</span>
                <span className={selected.stale ? styles.warningText : styles.verifiedText}>{selected.stale ? <Clock3 /> : <BadgeCheck />}{selected.stale ? "Snapshot is stale" : "Snapshot verified"}</span>
              </div>
              <a data-action-id="discover.open_repository" href={selected.sourceUrl} target="_blank" rel="noreferrer" className={styles.secondaryButton}>GitHub <ExternalLink /></a>
            </section>

            <section className={styles.deltaSection}>
              <div className={styles.sectionHeading}>
                <div><p className={styles.sectionKicker}>Verified repository delta</p><h2>What changed since the previous snapshot</h2></div>
                <div className={styles.timestampGroup}><span>Current · {formatDate(initialData.changes.currentObservedAt)}</span><span>Previous · {formatDate(initialData.changes.previousObservedAt)}</span></div>
              </div>
              {initialData.changes.kind === "baseline" && <div className={styles.baselineNotice}><BadgeCheck /> Baseline established. Change detection begins when a later snapshot has a different verified fingerprint.</div>}
              <div className={styles.deltaGrid}>{initialData.changes.rows.map((row) => <div key={row.key} className={styles.deltaItem}><span>{row.label}</span><strong>{row.unit === "USD" ? usd.format(row.after) : number.format(row.after)}</strong><ChangeValue row={row} /></div>)}</div>
            </section>

            <section className={styles.coverageSection}>
              <div className={styles.sectionHeading}>
                <div><p className={styles.sectionKicker}>Program coverage</p><h2>Accepted work mapped to active policy</h2><p>Coverage is claimed only when a deployed program has a normalized active policy matching the work category.</p></div>
                <button type="button" data-action-id="discover.start_mission" className={styles.primaryButton} disabled={pending !== null} onClick={() => void startMission()}><Sparkles />{pending === "mission" ? "Opening Mission…" : "Decide in Mission"}</button>
              </div>
              <div className={styles.coverageTableWrap}>
                <table className={styles.coverageTable}>
                  <thead><tr><th>Work category</th><th>Accepted records</th><th>Contributors</th><th>Policy state</th><th>Mechanism</th></tr></thead>
                  <tbody>{initialData.coverage.map((row) => <tr key={row.category}>
                    <td><strong>{row.label}</strong></td><td>{number.format(row.activityCount)}</td><td>{number.format(row.contributorCount)}</td><td><StatusDot state={row.status} /></td>
                    <td><span>{row.mechanism}</span>{row.programIds.map((programId, index) => <Link key={programId} data-action-id="discover.open_program" href={`/programs/${encodeURIComponent(programId)}`} className={styles.inlineLink}>{row.programNames[index] ?? "Open program"}<ArrowRight /></Link>)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>

            <div className={styles.analysisGrid}>
              <section className={styles.panel}>
                <div className={styles.panelHeading}><CircleAlert /><div><p className={styles.sectionKicker}>Recognition debt</p><h2>Verified work outside active policy</h2></div><strong>{number.format(initialData.recognitionDebt.length)}</strong></div>
                <div className={styles.debtSummary}>
                  <span>{initialData.recognitionSummary.categories.length ? initialData.recognitionSummary.categories.join(" · ") : "No uncovered category"}</span>
                  <strong>{initialData.recognitionSummary.amountUsd === null ? "No amount available" : usd.format(initialData.recognitionSummary.amountUsd)}</strong>
                  <small>{initialData.recognitionSummary.amountState === "modeled_estimate" ? "Modeled estimate — not owed or claimable" : initialData.recognitionSummary.amountState.replaceAll("_", " ")}</small>
                </div>
                {initialData.recognitionDebt.length ? <div className={styles.recordList}>{initialData.recognitionDebt.slice(0, 6).map((record) => <article key={record.id} className={styles.record}>
                  <div><span>{record.category.replaceAll("_", " ")}</span><time>{formatDate(record.occurredAt)}</time></div><h3>{record.title}</h3><p>{record.reason}</p>
                  <Link data-action-id="discover.open_evidence" href={`/api/discover/oss-evidence/${encodeURIComponent(record.id)}`} target="_blank" className={styles.inlineLink}>Proof on GitHub <ExternalLink /></Link>
                </article>)}</div> : <p className={styles.truthEmpty}>No recognition debt is proven by this snapshot. Categories with no activity are not counted as gaps.</p>}
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeading}><Users /><div><p className={styles.sectionKicker}>Maintainer concentration</p><h2>Who carries critical work</h2></div></div>
                <div className={styles.concentrationList}>{initialData.concentration.map((row) => <article key={row.category}>
                  <div><strong>{row.label}</strong><span>{row.topTwoSharePct}% top-two share</span></div><div className={styles.shareTrack}><i style={{ width: `${row.topTwoSharePct}%` }} /></div><p>{row.statement}</p>
                  {row.topActors.length > 0 && <small>{row.topActors.map((actor) => `@${actor.actor} · ${actor.count}`).join("  /  ")}</small>}
                </article>)}</div>
              </section>
            </div>

            <AttributionPanel data={initialData} />

            <section className={styles.fundingSection}>
              <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Funding coverage</p><h2>Can recognized work actually be paid?</h2></div><span className={styles.persistedBadge}><Activity /> Persisted financial records only</span></div>
              <div className={styles.fundingGrid}>
                <Metric label="Recognized obligations" value={usd.format(initialData.funding.recognizedUsd)} detail="Non-cancelled normalized obligations" />
                <Metric label="Confirmed pool capital" value={usd.format(initialData.funding.confirmedPoolUsd)} detail={`${initialData.funding.programCount} active normalized programs`} />
                <Metric label="Available now" value={usd.format(initialData.funding.availablePoolUsd)} detail="Deposits less released capital" />
                <Metric label="Funding shortfall" value={usd.format(initialData.funding.shortfallUsd)} detail="Recognized minus available capital" />
                <Metric label="Eligible recipients" value={number.format(initialData.funding.eligibleRecipients)} detail="Verified identity and payout destination" />
                <Metric label="Blocked recipients" value={number.format(initialData.funding.blockedRecipients)} detail="Exact recovery is listed below" />
              </div>
              <p className={styles.estimateNote}>Repository-level sustainability estimate: <strong>{usd.format(initialData.funding.repositoryGapEstimateUsd)}</strong>. This heuristic is separate from persisted obligations and confirmed capital.</p>
              <div className={styles.blockerList}>{initialData.blockers.length ? initialData.blockers.map((blocker) => <div key={blocker.code} className={styles.blockerRow}>
                <span><CircleAlert />{blocker.label}<strong>{blocker.count}</strong></span>
                {blocker.code === "insufficient_funding" ? <Link data-action-id="capital.open_funding" href={blocker.recoveryHref}>Review funding <ArrowRight /></Link> : <Link data-action-id="discover.resolve_identity" href={blocker.recoveryHref}>Resolve blocker <ArrowRight /></Link>}
              </div>) : <div className={styles.baselineNotice}><CheckCircle2 /> No persisted identity, payout, or funding blocker is currently recorded.</div>}</div>
            </section>

            <section id="community-pools" className={styles.poolSection}>
              <div className={styles.sectionHeading}>
                <div><p className={styles.sectionKicker}>Community capital graph</p><h2>How shared capital reaches verified contributors</h2><p>Funders deposit into a communal pool. Versioned policy and verified obligations determine recipients; funders cannot manually change payees or weights.</p></div>
                <span className={styles.persistedBadge}><WalletCards /> Ledger-backed values</span>
              </div>
              {initialData.pools.length ? <div className={styles.poolList}>{initialData.pools.map((pool) => <article key={pool.programId} className={styles.poolCard}>
                <div className={styles.poolIdentity}>
                  <span className={styles.poolIcon}><CircleDollarSign /></span>
                  <div><span>{pool.communitySlug} · {pool.status} · {pool.distributionState.replaceAll("_", " ")}</span><h3>{pool.programName}</h3><p>{pool.rationale}</p></div>
                  <div className={styles.poolLinks}><Link data-action-id="discover.open_program" href={pool.programHref}>Program <ArrowRight /></Link><Link data-action-id="capital.open_funding" href={pool.fundingHref}>Deposit in Capital <ArrowRight /></Link></div>
                </div>
                <div className={styles.poolEconomics}>
                  <Metric label="Confirmed pool" value={usd.format(pool.poolBalanceUsd)} detail={`${pool.funderCount} persisted ${pool.funderCount === 1 ? "funder" : "funders"}`} />
                  <Metric label="Available now" value={usd.format(pool.availableUsd)} detail="Deposits less released capital" />
                  <Metric label="Recognized owed" value={usd.format(pool.recognizedOwedUsd)} detail={`${pool.authorizationCount} ledger ${pool.authorizationCount === 1 ? "authorization" : "authorizations"}`} />
                  <Metric label="Already settled" value={usd.format(pool.settledUsd)} detail="Recorded by the authorization ledger" />
                </div>
                <div className={styles.poolOperationalGrid}>
                  <div className={styles.checkpointPanel}>
                    <div className={styles.poolSubhead}><span>Next checkpoint</span><strong>{pool.nextCheckpointUsd === null ? "No open checkpoint" : usd.format(pool.nextCheckpointUsd)}</strong></div>
                    <PoolProgress value={pool.progressToNextPct} />
                    <div className={styles.checkpointFacts}><span>{number.format(pool.progressToNextPct)}% funded</span><span>{pool.nextCheckpointUsd === null ? "Checkpoint ladder complete" : `${usd.format(pool.remainingToCheckpointUsd)} remaining`}</span></div>
                    <p>{pool.autoSettleEnabled ? "Automatic settlement is permitted by this program policy after its checkpoint conditions are satisfied." : "This policy requires operator authorization after its checkpoint conditions are satisfied."}</p>
                    {pool.policyCoverage.length > 0 && <div className={styles.coverageChips}>{pool.policyCoverage.map((label) => <span key={label}>{label}</span>)}</div>}
                    <div className={styles.conditionList}>{pool.milestoneConditions.map((condition) => <div key={condition.id} data-ready={condition.met}><span>{condition.met ? <CheckCircle2 /> : <CircleAlert />}{condition.label}</span><small>{condition.detail}</small></div>)}</div>
                    <div className={styles.policyModes}>
                      {pool.policyVersionId ? <span><ShieldCheck /> Policy v{pool.policyVersion ?? "recorded"}</span> : <span><CircleAlert /> Normalized policy missing</span>}
                      {pool.retroactiveMode && <span><Clock3 /> Retroactive funding</span>}
                      {pool.matchingMode && <span><Scale /> Quadratic matching configured</span>}
                      {pool.dependencySupportPercent > 0 && <span><Link2 /> {pool.dependencySupportPercent}% dependency support</span>}
                    </div>
                  </div>
                  <div className={styles.queuePanel}>
                    <div className={styles.poolSubhead}><span>Next verified allocation</span><strong>{pool.queuedPayees.length ? `${pool.queuedPayees.length} ${pool.payeeCategory}` : "Queue empty"}</strong></div>
                    {pool.queuedPayees.length ? <div className={styles.payeeList}>{pool.queuedPayees.map((payee) => <div key={payee.label}><span>{payee.label}</span><strong>{usd.format(payee.owedUsd)}</strong></div>)}</div> : <p className={styles.inlineTruth}>No funded, claimable, or pending-funding authorization is queued for this program.</p>}
                    <div className={styles.queueTotal}><span>Queued from persisted authorizations</span><strong>{usd.format(pool.queuedTotalUsd)}</strong></div>
                  </div>
                  <div className={styles.poolProofPanel}>
                    <div className={styles.poolSubhead}><span>Distribution record</span><strong>{pool.contributorCount} contributors</strong></div>
                    <div className={styles.proofFacts}><span><strong>{usd.format(pool.claimableUsd)}</strong> claimable</span><span><strong>{pool.paidCheckpoints.length}</strong> paid checkpoints recorded</span></div>
                    {pool.paidCheckpoints.length > 0 ? <div className={styles.paidList}>{pool.paidCheckpoints.slice(0, 3).map((batch) => <div key={batch.id}><span>{formatDate(batch.at)} · {batch.payeeCount} payees</span><strong>{usd.format(batch.settledUsd)}</strong></div>)}</div> : <p className={styles.inlineTruth}>No paid checkpoint is recorded for this pool. Confirmed Arc outcomes appear only in the receipt section below.</p>}
                  </div>
                </div>
              </article>)}</div> : <p className={styles.truthEmpty}>No active normalized funding pool is attached to this repository context. RESOLVE will not invent a milestone, deposit, allocation, or payout preview.</p>}
            </section>

            <SupporterLedger data={initialData} signedIn={Boolean(user)} onSignIn={openSignIn} />

            <section className={styles.outcomeSection}>
              <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Outcome proof</p><h2>Confirmed distributions with receipts</h2><p>Submitted settlements never appear here. Every row requires a confirmed batch, persisted transaction hash, and issued receipt.</p></div></div>
              {initialData.outcomes.length ? <div className={styles.outcomeList}>{initialData.outcomes.map((outcome) => <article key={outcome.receiptId}>
                <BadgeCheck /><div><span>{outcome.publicReference}</span><strong>{usd.format(outcome.totalUsd)} · {outcome.payeeCount} payees</strong><small>Issued {formatDate(outcome.issuedAt)}</small></div>
                <div className={styles.outcomeActions}><Link data-action-id="receipt.open" href={`/outcomes/${encodeURIComponent(outcome.publicReference)}`}>Receipt <ArrowRight /></Link><a data-action-id="receipt.open_arcscan" href={`https://testnet.arcscan.app/tx/${outcome.txHash}`} target="_blank" rel="noreferrer">Transaction <ExternalLink /></a></div>
              </article>)}</div> : <p className={styles.truthEmpty}>No confirmed settlement with both a persisted transaction hash and receipt is attached to this repository context yet.</p>}
            </section>

            {initialData.degradedSources.length > 0 && <aside className={styles.degradedNotice} role="status"><CircleAlert /> Some secondary records are temporarily unavailable: {initialData.degradedSources.join(", ")}. Repository analysis remains readable.</aside>}
          </>
        )}
      </div>
    </main>
  );
}
