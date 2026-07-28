"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileCheck2,
  GitBranch,
  Landmark,
  RefreshCw,
  Settings2,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
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
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const FILTERS: Array<{ id: WorkLedgerFilter; label: string }> = [
  { id: "needs_action", label: "Needs Action" },
  { id: "ready", label: "Ready" },
  { id: "in_progress", label: "In Progress" },
  { id: "paid", label: "Paid" },
  { id: "all", label: "All" },
];

type SecondaryPanel = "pools" | "contributors" | "activity" | "outcomes" | "advanced";

const SECONDARY_PANELS: Array<{
  id: SecondaryPanel;
  label: string;
  icon: typeof Landmark;
}> = [
  { id: "pools", label: "Pools", icon: Landmark },
  { id: "contributors", label: "Contributors", icon: Users },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "outcomes", label: "Outcomes", icon: BadgeCheck },
  { id: "advanced", label: "Advanced", icon: Settings2 },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unavailable" : dateTime.format(parsed);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function recordState(record: FundingCoverageLedgerRecord) {
  if (record.filter === "paid") return "Paid";
  if (record.filter === "ready") return "Ready";
  if (record.filter === "in_progress") return "In Progress";
  return "Needs Action";
}

function appendReturnContext(href: string, returnTo: string) {
  if (href.startsWith("http") || href.includes("returnTo=")) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

export function DiscoverCoverageIntelligence({ data }: { data: DiscoverOssIntelligence }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const { state: connections, loading: connectionsLoading } = useUserConnections();
  const githubIdentity = connections.platforms.find((row) => row.id === "github");
  const githubRepositoryAccess = connections.platforms.find((row) => row.id === "github_app");
  const command = data.commandCentre;
  const selected = data.selected;
  const initialFilter = searchParams.get("filter") as WorkLedgerFilter | null;
  const [filter, setFilter] = useState<WorkLedgerFilter>(
    FILTERS.some((item) => item.id === initialFilter) ? initialFilter! : "needs_action",
  );
  const [repository, setRepository] = useState(selected?.fullName ?? "");
  const [pending, setPending] = useState<"snapshot" | "mission" | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [showAllWork, setShowAllWork] = useState(false);
  const [recordId, setRecordId] = useState(searchParams.get("record"));
  const initialPanel = searchParams.get("panel") as SecondaryPanel | null;
  const [secondaryPanel, setSecondaryPanel] = useState<SecondaryPanel | null>(
    SECONDARY_PANELS.some((item) => item.id === initialPanel) ? initialPanel : null,
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const filteredLedger = useMemo(
    () => command.ledger.filter((record) => filter === "all" || record.filter === filter),
    [command.ledger, filter],
  );
  const visibleLedger = showAllWork ? filteredLedger : filteredLedger.slice(0, 5);
  const activeRecord = command.ledger.find((record) => record.id === recordId) ?? null;
  const contributors = useMemo(() => {
    const rows = new Map<string, { login: string; count: number; categories: Set<string> }>();
    command.ledger.forEach((record) => {
      const key = record.contributor.toLowerCase();
      const current = rows.get(key) ?? {
        login: record.contributor,
        count: 0,
        categories: new Set<string>(),
      };
      current.count += 1;
      current.categories.add(record.workType);
      rows.set(key, current);
    });
    return [...rows.values()].sort((left, right) => right.count - left.count);
  }, [command.ledger]);
  const returnTo = selected
    ? `/discover?repo=${encodeURIComponent(selected.fullName)}${recordId ? `&record=${encodeURIComponent(recordId)}` : ""}`
    : "/discover";
  const criticalFailure = data.degradedSources.some((source) =>
    ["discover_intelligence", "snapshot_history", "proof_events", "programs", "policies"].includes(source));
  const optionalFailures = data.degradedSources.filter((source) =>
    !["discover_intelligence", "snapshot_history", "proof_events", "programs", "policies"].includes(source));

  const updateUrl = useCallback((values: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(values).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const query = params.toString();
    router.replace(query ? `/discover?${query}` : "/discover", { scroll: false });
  }, [router, searchParams]);

  const closeRecord = useCallback(() => {
    setRecordId(null);
    updateUrl({ record: null });
  }, [updateUrl]);

  useEffect(() => {
    if (!activeRecord) return;
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeRecord();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeRecord, closeRecord]);

  function selectRepository(value: string) {
    setRepository(value);
    setMessage(null);
    router.push(value ? `/discover?repo=${encodeURIComponent(value)}` : "/discover");
  }

  function selectFilter(next: WorkLedgerFilter) {
    setFilter(next);
    setShowAllWork(false);
    updateUrl({ filter: next === "needs_action" ? null : next, record: null });
  }

  function selectSecondaryPanel(next: SecondaryPanel) {
    const selectedPanel = secondaryPanel === next ? null : next;
    setSecondaryPanel(selectedPanel);
    updateUrl({ panel: selectedPanel });
  }

  function openRecord(record: FundingCoverageLedgerRecord) {
    setRecordId(record.id);
    updateUrl({ record: record.id });
  }

  async function captureSnapshot(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const target = repository.trim();
    if (!target) {
      setMessage({ kind: "error", text: "Select or enter a GitHub repository first." });
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
      router.push(`/discover?repo=${encodeURIComponent(body.repository)}`);
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
      setMessage({ kind: "error", text: "Refresh the persisted evaluation before opening Mission." });
      return;
    }
    setPending("mission");
    setMessage(null);
    try {
      const selectedEvidenceIds = evidenceIds?.length
        ? evidenceIds
        : data.recognitionDebt.slice(0, 50).map((record) => record.id);
      const recordContext = evidenceIds?.[0] ? `&record=${encodeURIComponent(evidenceIds[0])}` : "";
      const missionReturnTo =
        `/discover?repo=${encodeURIComponent(selected.fullName)}${recordContext}`;
      const response = await fetch("/api/discover/oss-missions", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repository: selected.fullName,
          fingerprint: selected.fingerprint,
          objective: `Decide how active programs should recognize and fund accepted work in ${selected.fullName}.`,
          evidenceIds: selectedEvidenceIds,
          returnTo: missionReturnTo,
        }),
      });
      const body = await response.json() as { ok?: boolean; href?: string; error?: string };
      if (!response.ok || !body.ok || !body.href) {
        throw new Error(body.error ?? "Mission could not be opened.");
      }
      router.push(body.href);
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Mission could not be opened.",
      });
      setPending(null);
    }
  }

  function renderAction(
    action: FundingCoverageAction,
    evidenceIds?: string[],
    className?: string,
  ): ReactNode {
    if (action.id === "discover.start_mission") {
      return (
        <button
          type="button"
          className={className}
          data-action-id={action.id}
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
          className={className}
          data-action-id={action.id}
          disabled={pending !== null || !repository}
          onClick={() => void captureSnapshot()}
        >
          <RefreshCw aria-hidden="true" />
          {pending === "snapshot" ? "Refreshing…" : action.label}
        </button>
      );
    }
    if (!action.href) return null;
    return (
      <Link
        className={className}
        href={appendReturnContext(action.href, returnTo)}
        data-action-id={action.id}
      >
        {action.label}
        <ArrowRight aria-hidden="true" />
      </Link>
    );
  }

  if (!selected) {
    const identityConnected = Boolean(githubIdentity?.connected);
    const repositoryAccessConnected = Boolean(githubRepositoryAccess?.connected);
    const setupTitle =
      !identityConnected
        ? "Connect your GitHub identity"
        : !repositoryAccessConnected
          ? "Install repository access"
          : "Choose a repository";
    const setupDescription =
      !identityConnected
        ? "Connect GitHub once, then RESOLVE will use the same confirmed account across Discover, Mission, Communities, Earn, Capital, and Profile."
        : !repositoryAccessConnected
          ? `${githubIdentity?.displayValue ?? "Your GitHub identity"} is connected. Install the RESOLVE GitHub App to select private or organization repositories.`
          : `${githubRepositoryAccess?.displayValue ?? "Repository access is connected"}. Select a stored repository or enter an owner/repository name to evaluate it.`;
    return (
      <section className={styles.shell} aria-labelledby="discover-title">
        <header className={styles.pageHeader}>
          <div>
            <p>Discover</p>
            <h1 id="discover-title">Accepted work that needs economic attention</h1>
            <span>Connect one source, then RESOLVE will evaluate blockers and recommend the next action.</span>
          </div>
        </header>

        <section className={styles.setupPanel} aria-labelledby="connect-repository-title">
          <div className={styles.setupIcon}><GitBranch aria-hidden="true" /></div>
          <div>
            <p>Source setup</p>
            <h2 id="connect-repository-title">{setupTitle}</h2>
            <span>{connectionsLoading ? "Checking your confirmed connections..." : setupDescription}</span>
          </div>
          {data.repositories.length > 0 && (
            <label className={styles.setupSelect}>
              <span>Available repositories</span>
              <select
                aria-label="Select repository"
                data-action-id="discover.select_repository"
                value={repository}
                onChange={(event) => selectRepository(event.target.value)}
              >
                <option value="">Select repository</option>
                {data.repositories.map((option) => (
                  <option key={option.fullName} value={option.fullName}>{option.fullName}</option>
                ))}
              </select>
            </label>
          )}
          {repositoryAccessConnected && data.repositories.length === 0 && (
            <label className={styles.setupSelect}>
              <span>GitHub repository</span>
              <input
                aria-label="GitHub repository"
                value={repository}
                placeholder="owner/repository"
                onChange={(event) => setRepository(event.target.value)}
              />
            </label>
          )}
          <div className={styles.setupActions}>
            {!identityConnected ? (
              <Link
                href={`/connect/github?returnTo=${encodeURIComponent("/discover")}`}
                data-action-id="profile.connect_source"
                className={styles.primaryAction}
              >
                Connect GitHub <ArrowRight aria-hidden="true" />
              </Link>
            ) : !repositoryAccessConnected ? (
              <Link
                href={`/connect/github/install?returnTo=${encodeURIComponent("/discover")}`}
                data-action-id="profile.install_github_app"
                className={styles.primaryAction}
              >
                Install GitHub App <ArrowRight aria-hidden="true" />
              </Link>
            ) : data.repositories.length === 0 ? (
              <button
                type="button"
                className={styles.primaryAction}
                disabled={pending === "snapshot" || !repository.trim()}
                onClick={() => void captureSnapshot()}
              >
                {pending === "snapshot" ? "Evaluating..." : "Evaluate repository"}
                <ArrowRight aria-hidden="true" />
              </button>
            ) : null}
            {data.repositories.length > 0 && (
              <button
                type="button"
                data-action-id="discover.select_repository"
                onClick={() => document.querySelector<HTMLSelectElement>("[data-action-id='discover.select_repository']")?.focus()}
              >
                Select repository
              </button>
            )}
            {criticalFailure && (
              <button
                type="button"
                onClick={() => router.refresh()}
              >
                <RefreshCw aria-hidden="true" />
                Retry data
              </button>
            )}
          </div>
          {criticalFailure && (
            <p className={styles.errorNotice} role="status">
              GitHub evaluation is temporarily unavailable. Existing production records were not
              replaced with placeholder data.
            </p>
          )}
          {message && (
            <p className={message.kind === "success" ? styles.successNotice : styles.errorNotice} role="status">
              {message.text}
            </p>
          )}
        </section>
      </section>
    );
  }

  return (
    <section className={styles.shell} aria-labelledby="discover-title">
      <header className={styles.pageHeader}>
        <div>
          <p>Discover</p>
          <h1 id="discover-title">Economic attention for accepted work</h1>
          <span>One repository, one funding cycle, and one recommended next action.</span>
        </div>
        <div className={styles.pageStatus}>
          <BadgeCheck aria-hidden="true" />
          <span>{number.format(data.proof.persistedEvents)} persisted events</span>
        </div>
      </header>

      <div className={styles.contextBar} aria-label="Funding evaluation context">
        <ContextFact label="Community" value={command.context.community ?? "Unavailable"} />
        <label className={styles.repositorySelect}>
          <span>Repository</span>
          <select
            aria-label="Repository source"
            data-action-id="discover.select_repository"
            value={selected.fullName}
            onChange={(event) => selectRepository(event.target.value)}
          >
            {data.repositories.map((option) => (
              <option key={option.fullName} value={option.fullName}>{option.fullName}</option>
            ))}
          </select>
        </label>
        <ContextFact
          label="Evaluation period"
          value={`${formatDate(command.context.evaluationStart)} to ${formatDate(command.context.evaluationEnd)}`}
        />
        <ContextFact
          label="GitHub source"
          value={criticalFailure ? "Needs attention" : command.context.sourceLabel}
          tone={criticalFailure ? "warning" : "positive"}
        />
        <ContextFact
          label="Last verified event"
          value={formatDate(command.context.latestVerifiedEventAt)}
        />
        <button
          type="button"
          className={styles.refreshButton}
          data-action-id="discover.capture_repository_snapshot"
          disabled={pending !== null}
          onClick={() => void captureSnapshot()}
        >
          <RefreshCw aria-hidden="true" />
          {pending === "snapshot" ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {message && (
        <p className={message.kind === "success" ? styles.successNotice : styles.errorNotice} role="status">
          {message.text}
        </p>
      )}
      {selected.stale && (
        <p className={styles.staleNotice} role="status">
          <Clock3 aria-hidden="true" />
          This repository evaluation is stale. Last-known persisted records remain visible while
          RESOLVE prepares a fresh evaluation.
        </p>
      )}
      {optionalFailures.length > 0 && (
        <p className={styles.degradedNotice} role="status">
          Some optional financial details are unavailable. The work evaluation remains usable.
        </p>
      )}

      <section className={styles.summaryPanel} aria-labelledby="funding-cycle-title">
        <div className={styles.summaryCopy}>
          <p>Autonomous evaluation</p>
          <h2 id="funding-cycle-title">Funding cycle</h2>
          <span>{command.summary}</span>
        </div>
        <div className={styles.cycleRail} aria-label="Funding cycle stages">
          {command.pulse.map((stage) => (
            <button
              key={stage.id}
              type="button"
              data-action-id="discover.filter_ledger"
              className={filter === stage.filter ? styles.cycleActive : undefined}
              onClick={() => selectFilter(stage.filter)}
            >
              <strong>{stage.value === null ? "—" : number.format(stage.value)}</strong>
              <span>{stage.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.nextAction} aria-labelledby="next-action-title">
        <div className={styles.nextActionIcon}><CircleAlert aria-hidden="true" /></div>
        <div className={styles.nextActionCopy}>
          <p>Recommended next action</p>
          {command.nextAction ? (
            <>
              <h2 id="next-action-title">{command.nextAction.reason}</h2>
              <span>
                RESOLVE selected the earliest unresolved blocker. Human approval remains required
                for policy activation and financial authorization.
              </span>
            </>
          ) : (
            <>
              <h2 id="next-action-title">No action required</h2>
              <span>The current persisted evaluation has no unresolved operator blocker.</span>
            </>
          )}
        </div>
        <div className={styles.nextActionButtons}>
          {command.nextAction && renderAction(command.nextAction, undefined, styles.primaryAction)}
          {command.ledger[0]?.evidenceState === "verified" && (
            <button
              type="button"
              data-action-id="discover.open_record"
              onClick={() => openRecord(command.ledger[0]!)}
            >
              Inspect evidence
            </button>
          )}
        </div>
      </section>

      <section className={styles.queueSection} aria-labelledby="work-queue-title">
        <div className={styles.queueHeader}>
          <div>
            <p>Priority queue</p>
            <h2 id="work-queue-title">Work requiring attention</h2>
            <span>Accepted records from {selected.fullName}, ordered by their current blocker.</span>
          </div>
          <div className={styles.filterTabs} role="tablist" aria-label="Work queue filters">
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
                  onClick={() => selectFilter(item.id)}
                >
                  {item.label}<span>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.queueList}>
          {visibleLedger.map((record) => (
            <article key={record.id} className={styles.queueRow}>
              <button
                type="button"
                className={styles.recordIdentity}
                data-action-id="discover.open_record"
                onClick={() => openRecord(record)}
              >
                <span>{record.workType}</span>
                <strong>{record.title}</strong>
                <small>{record.repository}</small>
              </button>
              <div className={styles.recordMeta}>
                <span>Contributor</span>
                <strong>@{record.contributor}</strong>
              </div>
              <div className={styles.recordMeta}>
                <span>Accepted</span>
                <strong>{formatDate(record.acceptedAt)}</strong>
              </div>
              <div className={styles.recordMeta}>
                <span>State</span>
                <strong className={record.filter === "needs_action" ? styles.warningText : undefined}>
                  {recordState(record)}
                </strong>
              </div>
              <div className={styles.recordBlocker}>
                <span>Blocker</span>
                <strong>{record.blocker}</strong>
                <small>
                  {record.amountUsd === null
                    ? "No verified amount"
                    : `${usd.format(record.amountUsd)} verified`}
                </small>
              </div>
              <div className={styles.recordActions}>
                {renderAction(record.nextAction, [record.evidenceId], styles.rowPrimaryAction)}
                <button
                  type="button"
                  data-action-id="discover.open_record"
                  onClick={() => openRecord(record)}
                >
                  Details
                </button>
              </div>
            </article>
          ))}
          {visibleLedger.length === 0 && (
            <p className={styles.emptyState}>
              No persisted work records match this state. RESOLVE does not substitute example records.
            </p>
          )}
        </div>

        {filteredLedger.length > 5 && (
          <button
            type="button"
            className={styles.viewAll}
            data-action-id="discover.filter_ledger"
            onClick={() => setShowAllWork((current) => !current)}
          >
            {showAllWork ? "Show priority five" : `View all work (${filteredLedger.length})`}
            <ChevronDown aria-hidden="true" />
          </button>
        )}
      </section>

      <section className={styles.secondarySection} aria-label="Discover secondary details">
        <div className={styles.secondaryTabs} role="tablist" aria-label="Funding cycle details">
          {SECONDARY_PANELS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={secondaryPanel === item.id}
                data-action-id={`discover.open_${item.id}`}
                onClick={() => selectSecondaryPanel(item.id)}
              >
                <Icon aria-hidden="true" />
                {item.label}
                <PanelCount panel={item.id} data={data} contributors={contributors.length} />
              </button>
            );
          })}
        </div>
        {secondaryPanel && (
          <div className={styles.secondaryContent}>
            {secondaryPanel === "pools" && (
              <PoolsPanel data={data} returnTo={returnTo} />
            )}
            {secondaryPanel === "contributors" && (
              <ContributorsPanel contributors={contributors} returnTo={returnTo} />
            )}
            {secondaryPanel === "activity" && (
              <ActivityPanel records={command.ledger.slice(0, 5)} />
            )}
            {secondaryPanel === "outcomes" && (
              <OutcomesPanel data={data} />
            )}
            {secondaryPanel === "advanced" && (
              <AdvancedPanel data={data} />
            )}
          </div>
        )}
      </section>

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
                <h2 id="record-detail-title">{activeRecord.title}</h2>
                <p>{activeRecord.repository} · @{activeRecord.contributor}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                data-action-id="discover.open_record"
                onClick={closeRecord}
                aria-label="Close record detail"
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div className={styles.drawerBody}>
              <DrawerSection title="Accepted work">
                <dl>
                  <DrawerFact label="Work type" value={activeRecord.workType} />
                  <DrawerFact label="Accepted" value={formatDate(activeRecord.acceptedAt)} />
                  <DrawerFact label="Contributor" value={`@${activeRecord.contributor}`} />
                  <DrawerFact label="Current state" value={recordState(activeRecord)} />
                </dl>
                <a
                  href={activeRecord.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-action-id="discover.open_evidence"
                >
                  Open GitHub activity <ExternalLink aria-hidden="true" />
                </a>
              </DrawerSection>
              <DrawerSection title="Evidence">
                <dl>
                  <DrawerFact label="Verification" value={humanize(activeRecord.evidenceState)} />
                  <DrawerFact label="Evidence reference" value={activeRecord.evidenceId} />
                  <DrawerFact label="Snapshot fingerprint" value={selected.fingerprint} />
                  <DrawerFact label="Freshness" value={activeRecord.freshness} />
                </dl>
              </DrawerSection>
              <DrawerSection title="Policy and attribution">
                <p>{activeRecord.policyReason}</p>
                <dl>
                  <DrawerFact label="Coverage" value={humanize(activeRecord.policyState)} />
                  <DrawerFact
                    label="Policy version"
                    value={activeRecord.policyVersion?.toString() ?? "No matching active policy"}
                  />
                  <DrawerFact label="Identity" value={humanize(activeRecord.identityState)} />
                  <DrawerFact label="Exact blocker" value={activeRecord.blocker} />
                </dl>
              </DrawerSection>
              <DrawerSection title="Pool and settlement">
                <dl>
                  <DrawerFact label="Amount state" value={humanize(activeRecord.amountState)} />
                  <DrawerFact
                    label="Verified amount"
                    value={activeRecord.amountUsd === null ? "No verified amount" : usd.format(activeRecord.amountUsd)}
                  />
                  <DrawerFact label="Pool" value={activeRecord.poolName ?? "No record-linked Pool"} />
                  <DrawerFact label="Pool state" value={humanize(activeRecord.poolState)} />
                </dl>
              </DrawerSection>
              <DrawerSection title="Timeline">
                <ol className={styles.timeline}>
                  {activeRecord.timeline.map((event) => (
                    <li key={`${event.at}:${event.label}`}>
                      <time dateTime={event.at}>{formatDate(event.at)}</time>
                      <span>{event.label}</span>
                    </li>
                  ))}
                </ol>
              </DrawerSection>
            </div>
            <div className={styles.drawerAction}>
              <div>
                <strong>Next valid action</strong>
                <span>{activeRecord.nextAction.reason}</span>
              </div>
              {renderAction(activeRecord.nextAction, [activeRecord.evidenceId], styles.primaryAction)}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function ContextFact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "warning";
}) {
  return (
    <div className={styles.contextFact}>
      <span>{label}</span>
      <strong className={tone === "positive" ? styles.positiveText : tone === "warning" ? styles.warningText : undefined}>
        {value}
      </strong>
    </div>
  );
}

function PanelCount({
  panel,
  data,
  contributors,
}: {
  panel: SecondaryPanel;
  data: DiscoverOssIntelligence;
  contributors: number;
}) {
  const counts: Record<SecondaryPanel, number | null> = {
    pools: data.pools.length,
    contributors,
    activity: data.commandCentre.ledger.length,
    outcomes: data.outcomes.length,
    advanced: null,
  };
  return counts[panel] === null ? null : <span>{counts[panel]}</span>;
}

function PoolsPanel({
  data,
  returnTo,
}: {
  data: DiscoverOssIntelligence;
  returnTo: string;
}) {
  if (data.pools.length === 0) {
    return <p className={styles.emptyState}>No persisted Pool is attached to this repository and its active programs.</p>;
  }
  return (
    <div className={styles.detailList}>
      {data.pools.map((pool) => (
        <article key={pool.programId}>
          <div>
            <span>{pool.policyCoverage.join(", ") || "Active program"}</span>
            <strong>{pool.programName}</strong>
            <small>
              {usd.format(pool.availableUsd)} available · {number.format(pool.authorizationCount)} valid obligations
            </small>
          </div>
          <Link
            href={appendReturnContext(pool.programHref, returnTo)}
            data-action-id="discover.open_program"
          >
            Open Pool
          </Link>
          <Link href={pool.fundingHref} data-action-id="capital.open_funding">Add Funds</Link>
        </article>
      ))}
    </div>
  );
}

function ContributorsPanel({
  contributors,
  returnTo,
}: {
  contributors: Array<{ login: string; count: number; categories: Set<string> }>;
  returnTo: string;
}) {
  if (contributors.length === 0) {
    return <p className={styles.emptyState}>No contributors are present in this repository evaluation.</p>;
  }
  return (
    <div className={styles.detailList}>
      {contributors.map((contributor) => (
        <article key={contributor.login}>
          <div>
            <span>{[...contributor.categories].join(", ")}</span>
            <strong>@{contributor.login}</strong>
            <small>{number.format(contributor.count)} accepted records</small>
          </div>
          <Link
            href={`/profile?section=identity&returnTo=${encodeURIComponent(returnTo)}`}
            data-action-id="discover.resolve_identity"
          >
            Open contributor
          </Link>
        </article>
      ))}
    </div>
  );
}

function ActivityPanel({ records }: { records: FundingCoverageLedgerRecord[] }) {
  if (records.length === 0) {
    return <p className={styles.emptyState}>No persisted source activity is available.</p>;
  }
  return (
    <ol className={styles.activityList}>
      {records.map((record) => (
        <li key={record.id}>
          <FileCheck2 aria-hidden="true" />
          <div>
            <strong>{record.workType} accepted</strong>
            <span>{record.title}</span>
          </div>
          <time dateTime={record.acceptedAt}>{formatDate(record.acceptedAt)}</time>
          <a href={record.sourceUrl} target="_blank" rel="noreferrer" data-action-id="discover.open_evidence">
            Inspect <ExternalLink aria-hidden="true" />
          </a>
        </li>
      ))}
    </ol>
  );
}

function OutcomesPanel({ data }: { data: DiscoverOssIntelligence }) {
  if (data.outcomes.length === 0) {
    return <p className={styles.emptyState}>No confirmed outcome or receipt is attached to this evaluation.</p>;
  }
  return (
    <div className={styles.detailList}>
      {data.outcomes.map((outcome) => (
        <article key={outcome.receiptId}>
          <div>
            <span>Confirmed {formatDate(outcome.issuedAt)}</span>
            <strong>{usd.format(outcome.totalUsd)}</strong>
            <small>{number.format(outcome.payeeCount)} contributors</small>
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
            View Arc transaction
          </a>
        </article>
      ))}
    </div>
  );
}

function AdvancedPanel({ data }: { data: DiscoverOssIntelligence }) {
  return (
    <div className={styles.advancedGrid}>
      <ContextFact label="Source" value={data.proof.source} />
      <ContextFact label="Verification" value={humanize(data.proof.verificationState)} />
      <ContextFact label="Snapshot" value={data.proof.snapshotId ?? "Unavailable"} />
      <ContextFact label="Generated" value={formatDate(data.generatedAt)} />
      <ContextFact
        label="Optional sources"
        value={data.degradedSources.length ? `${data.degradedSources.length} unavailable` : "Available"}
        tone={data.degradedSources.length ? "warning" : "positive"}
      />
      <ContextFact
        label="Evaluation change"
        value={data.changes.kind === "comparison" ? "Compared with previous snapshot" : "Baseline"}
      />
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function DrawerFact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
