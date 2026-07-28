"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileCheck2,
  Filter,
  GitBranch,
  Landmark,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import type { DiscoverOssIntelligence } from "@/lib/discover/oss-intelligence";
import type {
  FundingCoverageAction,
  FundingCoverageLedgerRecord,
  WorkLedgerFilter,
} from "@/lib/discover/funding-coverage";
import styles from "./discover-coverage-intelligence.module.css";

const number = new Intl.NumberFormat("en-US");
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const FILTERS: Array<{ id: WorkLedgerFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "needs_rule", label: "Needs Rule" },
  { id: "identity_blocked", label: "Identity Blocked" },
  { id: "funding_needed", label: "Funding Needed" },
  { id: "ready", label: "Ready" },
  { id: "in_progress", label: "In Progress" },
  { id: "paid", label: "Paid" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unavailable" : dateTime.format(parsed);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function actionId(action: FundingCoverageAction) {
  return action.id;
}

export function DiscoverCoverageIntelligence({ data }: { data: DiscoverOssIntelligence }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const command = data.commandCentre;
  const selected = data.selected;
  const initialFilter = searchParams.get("filter") as WorkLedgerFilter | null;
  const [filter, setFilter] = useState<WorkLedgerFilter>(
    FILTERS.some((item) => item.id === initialFilter) ? initialFilter! : "all",
  );
  const [category, setCategory] = useState<string>(searchParams.get("category") ?? "all");
  const [ledgerSearch, setLedgerSearch] = useState(searchParams.get("q") ?? "");
  const [repository, setRepository] = useState(selected?.fullName ?? "");
  const [pending, setPending] = useState<"snapshot" | "mission" | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [recordId, setRecordId] = useState(searchParams.get("record"));

  const filteredLedger = useMemo(() => {
    const query = ledgerSearch.trim().toLowerCase();
    return command.ledger.filter((record) => {
      if (filter !== "all" && record.filter !== filter) return false;
      if (category !== "all" && record.category !== category) return false;
      if (!query) return true;
      return [
        record.repository,
        record.workType,
        record.title,
        record.contributor,
        record.blocker,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [category, command.ledger, filter, ledgerSearch]);
  const activeRecord = command.ledger.find((record) => record.id === recordId) ?? null;
  const contributors = useMemo(() => {
    const rows = new Map<string, { login: string; count: number; categories: Set<string> }>();
    command.ledger.forEach((record) => {
      const key = record.contributor.toLowerCase();
      const current = rows.get(key) ?? { login: record.contributor, count: 0, categories: new Set<string>() };
      current.count += 1;
      current.categories.add(record.workType);
      rows.set(key, current);
    });
    return [...rows.values()].sort((left, right) => right.count - left.count).slice(0, 8);
  }, [command.ledger]);

  function updateUrl(values: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(values).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.replace(`/discover?${params.toString()}`, { scroll: false });
  }

  function selectRepository(value: string) {
    setRepository(value);
    if (value) router.push(`/discover?repo=${encodeURIComponent(value)}#funding-coverage-command-centre`);
  }

  function selectFilter(next: WorkLedgerFilter, nextCategory = category) {
    setFilter(next);
    setCategory(nextCategory);
    setVisibleCount(12);
    updateUrl({
      filter: next === "all" ? null : next,
      category: nextCategory === "all" ? null : nextCategory,
      record: null,
    });
    document.getElementById("discover-work-ledger")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openRecord(record: FundingCoverageLedgerRecord) {
    setRecordId(record.id);
    updateUrl({ record: record.id });
  }

  function closeRecord() {
    setRecordId(null);
    updateUrl({ record: null });
  }

  async function captureSnapshot(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
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
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repository: target }),
      });
      const body = await response.json() as { ok?: boolean; repository?: string; error?: string };
      if (!response.ok || !body.ok || !body.repository) {
        throw new Error(body.error ?? "The repository evaluation could not be refreshed.");
      }
      setMessage({ kind: "success", text: `Evaluation persisted for ${body.repository}.` });
      router.push(`/discover?repo=${encodeURIComponent(body.repository)}#funding-coverage-command-centre`);
      router.refresh();
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "The repository evaluation could not be refreshed.",
      });
    } finally {
      setPending(null);
    }
  }

  async function startMission(evidenceIds?: string[]) {
    if (!selected) return;
    if (!user) {
      openSignIn();
      return;
    }
    if (!selected.snapshotPersisted) {
      setMessage({ kind: "error", text: "Refresh the persisted evaluation before starting this Mission." });
      return;
    }
    setPending("mission");
    setMessage(null);
    try {
      const selectedEvidenceIds = evidenceIds?.length
        ? evidenceIds
        : data.recognitionDebt.slice(0, 50).map((record) => record.id);
      const recordContext = evidenceIds?.[0] ? `&record=${encodeURIComponent(evidenceIds[0])}` : "";
      const returnTo = `/discover?repo=${encodeURIComponent(selected.fullName)}${recordContext}#discover-work-ledger`;
      const response = await fetch("/api/discover/oss-missions", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repository: selected.fullName,
          fingerprint: selected.fingerprint,
          objective: `Decide how active programs should recognize and fund accepted work in ${selected.fullName}.`,
          evidenceIds: selectedEvidenceIds,
          returnTo,
        }),
      });
      const body = await response.json() as { ok?: boolean; href?: string; error?: string };
      if (!response.ok || !body.ok || !body.href) {
        throw new Error(body.error ?? "Mission could not be started.");
      }
      router.push(body.href);
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Mission could not be started.",
      });
      setPending(null);
    }
  }

  function renderAction(action: FundingCoverageAction, evidenceIds?: string[]) {
    if (action.id === "discover.start_mission") {
      return (
        <button
          type="button"
          data-action-id={actionId(action)}
          disabled={pending !== null}
          onClick={() => void startMission(evidenceIds)}
        >
          <Sparkles aria-hidden="true" />
          {pending === "mission" ? "Opening Mission…" : action.label}
        </button>
      );
    }
    if (action.id === "discover.capture_repository_snapshot") {
      return (
        <button
          type="button"
          data-action-id={actionId(action)}
          disabled={pending !== null}
          onClick={() => void captureSnapshot()}
        >
          <RefreshCw aria-hidden="true" />
          {pending === "snapshot" ? "Refreshing…" : action.label}
        </button>
      );
    }
    return action.href ? (
      <Link href={action.href} data-action-id={actionId(action)}>
        {action.label}
        <ArrowRight aria-hidden="true" />
      </Link>
    ) : null;
  }

  return (
    <section
      id="funding-coverage-command-centre"
      className={styles.section}
      aria-labelledby="funding-coverage-title"
    >
      <div className={styles.contextBar}>
        <div className={styles.contextIdentity}>
          <GitBranch aria-hidden="true" />
          <div>
            <span>Community</span>
            <strong>{command.context.community ?? "No community selected"}</strong>
          </div>
        </div>

        <label className={styles.repositorySelect}>
          <span>Repository</span>
          <select
            aria-label="Repository source"
            data-action-id="discover.select_repository"
            value={selected?.fullName ?? ""}
            onChange={(event) => selectRepository(event.target.value)}
          >
            {data.repositories.length === 0 && <option value="">Select a repository</option>}
            {data.repositories.map((option) => (
              <option key={option.fullName} value={option.fullName}>{option.fullName}</option>
            ))}
          </select>
        </label>

        <div className={styles.contextFact}>
          <span>Source</span>
          <strong><ShieldCheck aria-hidden="true" />{command.context.sourceLabel}</strong>
        </div>
        <div className={styles.contextFact}>
          <span>Evaluation period</span>
          <strong>{formatDate(command.context.evaluationStart)} to {formatDate(command.context.evaluationEnd)}</strong>
        </div>
        <div className={styles.contextFact}>
          <span>Latest verified event</span>
          <strong>{formatDate(command.context.latestVerifiedEventAt)}</strong>
        </div>
        <div className={styles.contextFact}>
          <span>Freshness</span>
          <strong className={command.context.freshness === "current" ? styles.good : styles.warn}>
            {humanize(command.context.freshness)}
          </strong>
        </div>

        <div className={styles.contextActions}>
          <button
            type="button"
            data-action-id="discover.compare_periods"
            onClick={() => setComparisonOpen((current) => !current)}
          >
            Compare periods
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            data-action-id="discover.capture_repository_snapshot"
            disabled={pending !== null || !repository}
            onClick={() => void captureSnapshot()}
          >
            <RefreshCw aria-hidden="true" />
            {pending === "snapshot" ? "Refreshing…" : "Refresh evaluation"}
          </button>
        </div>
      </div>

      {message && (
        <p className={message.kind === "success" ? styles.success : styles.error} role="status">
          {message.text}
        </p>
      )}

      <div className={styles.commandIntro}>
        <div>
          <p>Funding coverage</p>
          <h2 id="funding-coverage-title">Funding Coverage Command Centre</h2>
          <span>{command.summary}</span>
        </div>
        <div className={styles.proofStatus}>
          <BadgeCheck aria-hidden="true" />
          <span><strong>{number.format(data.proof.persistedEvents)}</strong> persisted proof events</span>
        </div>
      </div>

      {comparisonOpen && (
        <div className={styles.comparison} role="status">
          {data.changes.kind === "comparison" ? (
            data.changes.rows.slice(0, 4).map((row) => (
              <span key={row.key}>
                <strong>{row.label}</strong>
                {row.delta === null ? "Unavailable" : `${row.delta > 0 ? "+" : ""}${row.delta} ${row.unit}`}
              </span>
            ))
          ) : (
            <p>Baseline established. Changes will appear after the next completed evaluation.</p>
          )}
        </div>
      )}

      <div className={styles.pulseSection}>
        <div className={styles.sectionLabel}>
          <div><p>Funding Cycle Pulse</p><span>Click a stage to filter the Work Ledger.</span></div>
          <small>Counts retain their persisted unit</small>
        </div>
        <div className={styles.pulseRail} aria-label="Funding Cycle Pulse">
          {command.pulse.map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              data-action-id="discover.filter_ledger"
              className={filter === stage.filter ? styles.pulseActive : undefined}
              onClick={() => selectFilter(stage.filter)}
              title={stage.unavailableReason ?? `${stage.value} ${stage.unit}`}
            >
              <span>{index + 1}</span>
              <div>
                <strong>{stage.value === null ? "Unavailable" : number.format(stage.value)}</strong>
                <small>{stage.label}</small>
                <em>{stage.value === null ? stage.unavailableReason : stage.unit}</em>
              </div>
              {index < command.pulse.length - 1 && <ChevronRight aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.decisionGrid}>
        <article className={styles.nextAction}>
          <div className={styles.sectionLabel}>
            <div><p>Next Action</p><span>Selected by deterministic lifecycle priority.</span></div>
          </div>
          {command.nextAction ? (
            <>
              <div className={styles.nextActionBody}>
                <CircleAlert aria-hidden="true" />
                <div>
                  <span>{command.nextAction.recordCount === null ? "Source context" : `${command.nextAction.recordCount} affected records`}</span>
                  <h3>{command.nextAction.reason}</h3>
                  <p>
                    This action is recommended because it is the earliest unresolved blocker in the persisted funding cycle.
                  </p>
                </div>
              </div>
              <div className={styles.actionRow}>
                {renderAction(command.nextAction)}
                {command.ledger[0] && (
                  <button
                    type="button"
                    data-action-id="discover.open_record"
                    className={styles.secondaryButton}
                    onClick={() => openRecord(command.ledger[0]!)}
                  >
                    Inspect evidence
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className={styles.empty}>No immediate operational action is recorded for this evaluation.</p>
          )}
        </article>

        <article className={styles.coverageMatrix}>
          <div className={styles.sectionLabel}>
            <div><p>Funding Coverage Matrix</p><span>Accepted work and active policy coverage.</span></div>
            <small>
              {data.programs[0]?.policyVersion
                ? `Policy v${data.programs[0].policyVersion}`
                : "No active matching policy"}
            </small>
          </div>
          <div className={styles.matrixScroller}>
            <table>
              <thead>
                <tr>
                  <th>Work type</th>
                  <th>Accepted</th>
                  <th>Covered</th>
                  <th>Uncovered</th>
                  <th>Attribution blocked</th>
                  <th>Payout blocked</th>
                  <th>Obligations</th>
                  <th>Ready</th>
                  <th>Submitted</th>
                  <th>Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {command.matrix.map((row) => (
                  <tr key={row.category}>
                    <th>{row.label}</th>
                    {([
                      ["accepted", row.accepted, "all"],
                      ["covered", row.covered, "in_progress"],
                      ["uncovered", row.uncovered, "needs_rule"],
                      ["attribution", row.attributionBlocked, "identity_blocked"],
                      ["payout", row.payoutBlocked, "identity_blocked"],
                      ["obligations", row.obligations, "in_progress"],
                      ["ready", row.ready, "ready"],
                      ["submitted", row.submitted, "in_progress"],
                      ["confirmed", row.confirmed, "paid"],
                    ] as Array<[string, number | null, WorkLedgerFilter]>).map(([key, value, targetFilter]) => (
                      <td key={key}>
                        {value === null ? (
                          <span title="This state cannot be joined reliably to the selected work category.">—</span>
                        ) : (
                          <button
                            type="button"
                            data-action-id="discover.filter_ledger"
                            onClick={() => selectFilter(targetFilter, row.category)}
                          >
                            {number.format(value)}
                          </button>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {command.context.baseline && (
            <p className={styles.baseline}>Baseline established. Changes will appear after the next completed evaluation.</p>
          )}
        </article>
      </div>

      <section id="discover-work-ledger" className={styles.ledgerSection} aria-labelledby="work-ledger-title">
        <div className={styles.ledgerHeader}>
          <div>
            <p>Unpaid Work · Ready to Fund · Payment state</p>
            <h3 id="work-ledger-title">Work Ledger</h3>
            <span>Evidence-backed accepted activity, policy coverage, blockers, and the next valid action.</span>
          </div>
          <label className={styles.ledgerSearch}>
            <Search aria-hidden="true" />
            <span className="sr-only">Search Work Ledger</span>
            <input
              type="search"
              value={ledgerSearch}
              data-action-id="discover.search_ledger"
              placeholder="Search work, contributor, or blocker"
              onChange={(event) => {
                setLedgerSearch(event.target.value);
                setVisibleCount(12);
              }}
            />
          </label>
        </div>

        <div className={styles.filterTabs} role="tablist" aria-label="Work Ledger filters">
          {FILTERS.map((item) => {
            const count = item.id === "all"
              ? command.ledger.length
              : command.ledger.filter((record) => record.filter === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                data-action-id="discover.filter_ledger"
                onClick={() => selectFilter(item.id, "all")}
              >
                {item.label}<span>{count}</span>
              </button>
            );
          })}
          {(filter !== "all" || category !== "all") && (
            <button
              type="button"
              data-action-id="discover.filter_ledger"
              className={styles.clearFilter}
              onClick={() => selectFilter("all", "all")}
            >
              <X aria-hidden="true" /> Clear
            </button>
          )}
        </div>

        <div className={styles.ledgerTable}>
          <div className={styles.ledgerColumns} aria-hidden="true">
            <span>Accepted work</span>
            <span>Evidence and policy</span>
            <span>Money and Pool</span>
            <span>Blocker and action</span>
          </div>
          {filteredLedger.slice(0, visibleCount).map((record) => (
            <article key={record.id} className={styles.ledgerRow}>
              <button
                type="button"
                className={styles.recordOpen}
                data-action-id="discover.open_record"
                onClick={() => openRecord(record)}
                aria-label={`Inspect ${record.title}`}
              >
                <span className={styles.workType}>{record.workType}</span>
                <strong>{record.title}</strong>
                <small>{record.repository} · @{record.contributor}</small>
                <time dateTime={record.acceptedAt}>{formatDate(record.acceptedAt)}</time>
              </button>
              <div className={styles.recordState}>
                <span className={record.evidenceState === "verified" ? styles.statusGood : styles.statusNeutral}>
                  <FileCheck2 aria-hidden="true" />{humanize(record.evidenceState)}
                </span>
                <strong className={record.policyState === "covered" ? styles.good : styles.warn}>
                  {record.policyState === "covered"
                    ? `Covered${record.policyVersion ? ` by policy v${record.policyVersion}` : ""}`
                    : "No active funding rule"}
                </strong>
                <small>{record.policyReason}</small>
              </div>
              <div className={styles.recordState}>
                <span>{humanize(record.amountState)}</span>
                <strong>{record.amountUsd === null ? "No verified amount" : usd.format(record.amountUsd)}</strong>
                <small>
                  {record.poolName
                    ? `${record.poolName} · ${humanize(record.poolState)}`
                    : "No record-linked Pool"}
                </small>
              </div>
              <div className={styles.recordAction}>
                <span>{record.blocker}</span>
                {renderAction(record.nextAction, [record.evidenceId])}
                <button
                  type="button"
                  data-action-id="discover.open_record"
                  className={styles.inspectButton}
                  onClick={() => openRecord(record)}
                >
                  Inspect <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
          {filteredLedger.length === 0 && (
            <p className={styles.empty}>
              No persisted work records match this filter. This is not reported as zero activity for the source.
            </p>
          )}
        </div>
        {visibleCount < filteredLedger.length && (
          <button
            type="button"
            className={styles.loadMore}
            data-action-id="discover.filter_ledger"
            onClick={() => setVisibleCount((count) => count + 12)}
          >
            Load 12 more records
          </button>
        )}
      </section>

      <div className={styles.operationsGrid}>
        <section id="community-pools" className={styles.operationSection}>
          <div className={styles.sectionLabel}>
            <div><p>Pools</p><span>Confirmed communal capital and checkpoint readiness.</span></div>
            <Landmark aria-hidden="true" />
          </div>
          {data.pools.length ? data.pools.slice(0, 3).map((pool) => (
            <article key={pool.programId} className={styles.poolRow}>
              <div className={styles.poolTitle}>
                <span>Community Pool</span>
                <strong>{pool.programName}</strong>
                <small>{pool.communitySlug} · Policy {pool.policyVersion ?? "unavailable"}</small>
              </div>
              <dl>
                <div><dt>Confirmed</dt><dd>{usd.format(pool.poolBalanceUsd)}</dd></div>
                <div><dt>Reserved</dt><dd>{usd.format(Math.max(0, pool.poolBalanceUsd - pool.availableUsd))}</dd></div>
                <div><dt>Available</dt><dd>{usd.format(pool.availableUsd)}</dd></div>
                <div><dt>Pending deposits</dt><dd>Unavailable</dd></div>
                <div><dt>Remaining</dt><dd>{usd.format(pool.remainingToCheckpointUsd)}</dd></div>
                <div><dt>Valid obligations</dt><dd>{number.format(pool.authorizationCount)}</dd></div>
                <div><dt>Ready contributors</dt><dd>{number.format(pool.queuedPayees.length)}</dd></div>
                <div><dt>Queued amount</dt><dd>{usd.format(pool.queuedTotalUsd)}</dd></div>
              </dl>
              <div className={styles.poolProgress}>
                <span><i style={{ width: `${pool.progressToNextPct}%` }} /></span>
                <small>
                  {pool.nextCheckpointUsd === null
                    ? "Checkpoint ladder complete"
                    : `${usd.format(pool.poolBalanceUsd)} of ${usd.format(pool.nextCheckpointUsd)} confirmed`}
                </small>
              </div>
              <div className={styles.poolMeta}>
                <span>{pool.autoSettleEnabled ? "Autopay at checkpoint" : "Operator approval required in Capital"}</span>
                <span>{selected?.stale ? "Stale source data" : "Current evaluation"}</span>
              </div>
              <div className={styles.poolActions}>
                <Link href={pool.programHref} data-action-id="discover.open_program">Open Pool</Link>
                <Link href={pool.fundingHref} data-action-id="capital.open_funding">Add Funds</Link>
                <Link href={pool.programHref} data-action-id="discover.open_program">View Checkpoint</Link>
                <Link href={pool.fundingHref} data-action-id="capital.open_funding">View in Capital</Link>
              </div>
            </article>
          )) : (
            <p className={styles.empty}>
              An active policy and selected repository do not currently resolve to a persisted Pool. No sample balance is shown.
            </p>
          )}
        </section>

        <section className={styles.operationSection}>
          <div className={styles.sectionLabel}>
            <div><p>Contributors</p><span>Accepted work observed in this evaluation.</span></div>
            <Users aria-hidden="true" />
          </div>
          <div className={styles.contributorList}>
            {contributors.map((contributor) => (
              <article key={contributor.login}>
                <div><strong>@{contributor.login}</strong><span>{contributor.count} accepted records</span></div>
                <small>{[...contributor.categories].slice(0, 3).join(" · ")}</small>
                <Link
                  href={`/profile?section=identity&returnTo=${encodeURIComponent(`/discover?repo=${selected?.fullName ?? ""}`)}`}
                  data-action-id="discover.resolve_identity"
                >
                  Open contributor
                </Link>
              </article>
            ))}
            {contributors.length === 0 && <p className={styles.empty}>No accepted contributor records are available.</p>}
          </div>
        </section>

        <section className={styles.operationSection}>
          <div className={styles.sectionLabel}>
            <div><p>Live Signals</p><span>Persisted source activity, not generated network noise.</span></div>
            <Clock3 aria-hidden="true" />
          </div>
          <div className={styles.signalList}>
            {command.ledger.slice(0, 6).map((record) => (
              <article key={record.id}>
                <time dateTime={record.acceptedAt}>{formatDate(record.acceptedAt)}</time>
                <div>
                  <strong>{record.workType} accepted in {record.repository}</strong>
                  <span>{record.title}</span>
                </div>
                <a href={record.sourceUrl} target="_blank" rel="noreferrer" data-action-id="discover.open_evidence">
                  Inspect <ExternalLink aria-hidden="true" />
                </a>
              </article>
            ))}
            {command.ledger.length === 0 && <p className={styles.empty}>No persisted source signals are available.</p>}
          </div>
        </section>

        <section className={styles.operationSection}>
          <div className={styles.sectionLabel}>
            <div><p>Confirmed Outcomes</p><span>Receipts appear only after authoritative confirmation.</span></div>
            <BadgeCheck aria-hidden="true" />
          </div>
          <div className={styles.outcomeList}>
            {data.outcomes.slice(0, 4).map((outcome) => (
              <article key={outcome.receiptId}>
                <div>
                  <strong>{usd.format(outcome.totalUsd)} confirmed</strong>
                  <span>{number.format(outcome.payeeCount)} contributors · {formatDate(outcome.issuedAt)}</span>
                </div>
                <Link href={`/outcomes/${encodeURIComponent(outcome.publicReference)}`} data-action-id="receipt.open">
                  View receipt
                </Link>
                <a
                  href={`https://testnet.arcscan.app/tx/${outcome.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  data-action-id="receipt.open_arcscan"
                >
                  View transaction <ExternalLink aria-hidden="true" />
                </a>
              </article>
            ))}
            {data.outcomes.length === 0 && (
              <p className={styles.empty}>
                No confirmed settlement receipt is attached to this evaluation. Submitted payments are kept under In Progress.
              </p>
            )}
          </div>
        </section>
      </div>

      <details id="public-repository-analysis" className={styles.publicRepository}>
        <summary data-action-id="discover.open_public_repository_analysis">Try a public repository</summary>
        <form onSubmit={captureSnapshot} data-action-id="discover.capture_repository_snapshot">
          <label htmlFor="discover-repository-source">Public GitHub repository</label>
          <input
            id="discover-repository-source"
            aria-label="Public GitHub repository"
            data-action-id="discover.capture_repository_snapshot"
            value={repository}
            onChange={(event) => setRepository(event.target.value)}
            placeholder="owner/repository"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            data-action-id="discover.capture_repository_snapshot"
            disabled={pending !== null}
          >
            <RefreshCw aria-hidden="true" />
            {pending === "snapshot" ? "Evaluating…" : "Evaluate repository"}
          </button>
        </form>
        <p>Manual public analysis is secondary to repositories authorized through the organisation installation flow.</p>
      </details>

      {activeRecord && (
        <div className={styles.drawerBackdrop} role="presentation" onMouseDown={closeRecord}>
          <aside
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.drawerHeader}>
              <div>
                <span>{activeRecord.workType}</span>
                <h3 id="record-detail-title">{activeRecord.title}</h3>
                <p>{activeRecord.repository} · @{activeRecord.contributor}</p>
              </div>
              <button type="button" data-action-id="discover.open_record" onClick={closeRecord} aria-label="Close record detail">
                <X aria-hidden="true" />
              </button>
            </div>

            <div className={styles.drawerBody}>
              <section>
                <h4>What happened</h4>
                <dl>
                  <div><dt>Event type</dt><dd>{activeRecord.workType}</dd></div>
                  <div><dt>Accepted</dt><dd>{formatDate(activeRecord.acceptedAt)}</dd></div>
                  <div><dt>Contributor</dt><dd>@{activeRecord.contributor}</dd></div>
                  <div><dt>Lifecycle</dt><dd>{activeRecord.filter === "needs_rule" ? "Accepted, policy blocked" : "Policy evaluated"}</dd></div>
                </dl>
                <a href={activeRecord.sourceUrl} target="_blank" rel="noreferrer" data-action-id="discover.open_evidence">
                  Open source activity <ExternalLink aria-hidden="true" />
                </a>
              </section>

              <section>
                <h4>Evidence</h4>
                <dl>
                  <div><dt>Verification</dt><dd>{humanize(activeRecord.evidenceState)}</dd></div>
                  <div><dt>Evidence reference</dt><dd>{activeRecord.evidenceId}</dd></div>
                  <div><dt>Snapshot fingerprint</dt><dd>{selected?.fingerprint ?? "Unavailable"}</dd></div>
                  <div><dt>Duplicate handling</dt><dd>Content-hash uniqueness enforced by persistence</dd></div>
                </dl>
              </section>

              <section>
                <h4>Funding-policy decision</h4>
                <p>{activeRecord.policyReason}</p>
                <dl>
                  <div><dt>Coverage</dt><dd>{humanize(activeRecord.policyState)}</dd></div>
                  <div><dt>Policy version</dt><dd>{activeRecord.policyVersion ?? "No matching active policy"}</dd></div>
                  <div><dt>Calculation</dt><dd>Deterministic category-to-active-policy match</dd></div>
                </dl>
              </section>

              <section>
                <h4>Contributor readiness</h4>
                <p>
                  Record-level identity and payout joins are not available in the current read model. RESOLVE does not infer readiness from a matching GitHub label.
                </p>
              </section>

              <section>
                <h4>Money state</h4>
                <dl>
                  <div><dt>Amount state</dt><dd>{humanize(activeRecord.amountState)}</dd></div>
                  <div><dt>Verified amount</dt><dd>{activeRecord.amountUsd === null ? "No amount" : usd.format(activeRecord.amountUsd)}</dd></div>
                  <div><dt>Pool</dt><dd>{activeRecord.poolName ?? "No record-linked Pool"}</dd></div>
                  <div><dt>Exact blocker</dt><dd>{activeRecord.blocker}</dd></div>
                </dl>
              </section>

              <section>
                <h4>Timeline</h4>
                <ol className={styles.timeline}>
                  {activeRecord.timeline.map((event) => (
                    <li key={`${event.at}:${event.label}`}>
                      <time dateTime={event.at}>{formatDate(event.at)}</time>
                      <span>{event.label}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <div className={styles.drawerAction}>
              <div><strong>Next valid action</strong><span>{activeRecord.nextAction.reason}</span></div>
              {renderAction(activeRecord.nextAction, [activeRecord.evidenceId])}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
