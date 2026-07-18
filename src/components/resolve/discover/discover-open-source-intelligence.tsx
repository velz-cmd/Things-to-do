"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowRight, BadgeCheck, BookOpenCheck, Boxes, CheckCircle2,
  CircleAlert, Clock3, ExternalLink, FileCode2, GitBranch, GitFork,
  GitPullRequest, Landmark, Network, ScanSearch, ShieldCheck, Sparkles, Users,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import type { DiscoverOssIntelligence, DiscoverRepositoryChange } from "@/lib/discover/oss-intelligence";
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

export function DiscoverOpenSourceIntelligence({ initialData }: { initialData: DiscoverOssIntelligence }) {
  const router = useRouter();
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const [repository, setRepository] = useState(initialData.selected?.fullName ?? "");
  const [pending, setPending] = useState<"snapshot" | "mission" | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const selected = initialData.selected;

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
            <div className={styles.eyebrow}><GitBranch aria-hidden="true" /> Open-source funding intelligence</div>
            <h1>See the work your ecosystem depends on—and what its funding programs miss.</h1>
            <p>Select a public repository. RESOLVE turns accepted GitHub activity into an auditable map of program coverage, recognition debt, maintainer concentration, funding readiness, and proven outcomes.</p>
            <form className={styles.repoForm} data-action-id="discover.capture_repository_snapshot" onSubmit={captureSnapshot}>
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

        {!selected ? (
          <section className={styles.emptyState}>
            <ScanSearch aria-hidden="true" />
            <div><p className={styles.sectionKicker}>No persisted repository snapshot</p><h2>Start with a real public repository.</h2><p>Analysis appears only after GitHub returns a repository and RESOLVE persists its verified activity snapshot. No sample results are shown as live data.</p></div>
          </section>
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
