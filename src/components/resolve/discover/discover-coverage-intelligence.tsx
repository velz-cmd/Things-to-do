"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  ExternalLink,
  GitBranch,
  Landmark,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import type { DiscoverOssIntelligence } from "@/lib/discover/oss-intelligence";
import styles from "./discover-coverage-intelligence.module.css";

const number = new Intl.NumberFormat("en-US");
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function DiscoverCoverageIntelligence({ data }: { data: DiscoverOssIntelligence }) {
  const router = useRouter();
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const [repository, setRepository] = useState(data.selected?.fullName ?? "");
  const [pending, setPending] = useState<"snapshot" | "mission" | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const selected = data.selected;
  const firstEvidence = data.recognitionDebt[0];
  const firstPool = data.pools[0];
  const firstOutcome = data.outcomes[0];

  function selectRepository(value: string) {
    setRepository(value);
    if (value) router.push(`/discover?repo=${encodeURIComponent(value)}#github-funding-intelligence`);
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
        throw new Error(body.error ?? "The repository snapshot could not be captured.");
      }
      setMessage({ kind: "success", text: `Verified snapshot persisted for ${body.repository}.` });
      router.push(`/discover?repo=${encodeURIComponent(body.repository)}#github-funding-intelligence`);
      router.refresh();
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "The repository snapshot could not be captured.",
      });
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
      setMessage({ kind: "error", text: "Refresh the verified snapshot before starting this Mission." });
      return;
    }
    setPending("mission");
    setMessage(null);
    try {
      const returnTo = `/discover?repo=${selected.fullName}#github-funding-intelligence`;
      const response = await fetch("/api/discover/oss-missions", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repository: selected.fullName,
          fingerprint: selected.fingerprint,
          objective: `Decide how active programs should recognize and fund accepted work in ${selected.fullName}.`,
          evidenceIds: data.recognitionDebt.slice(0, 50).map((record) => record.id),
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

  return (
    <section
      id="github-funding-intelligence"
      className={styles.section}
      aria-labelledby="github-funding-intelligence-title"
    >
      <div className={styles.contextBar}>
        <div className={styles.contextIdentity}>
          <GitBranch aria-hidden="true" />
          <div>
            <span>Repository intelligence</span>
            <strong>{selected?.fullName ?? "Select a verified source"}</strong>
          </div>
        </div>

        {data.repositories.length > 0 ? (
          <label className={styles.repositorySelect}>
            <span>Repository</span>
            <select
              aria-label="Repository source"
              data-action-id="discover.select_repository"
              value={selected?.fullName ?? ""}
              onChange={(event) => selectRepository(event.target.value)}
            >
              {data.repositories.map((option) => (
                <option key={option.fullName} value={option.fullName}>{option.fullName}</option>
              ))}
            </select>
          </label>
        ) : (
          <form className={styles.repositoryForm} onSubmit={captureSnapshot}>
            <label htmlFor="discover-repository-source">Public repository</label>
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
              {pending === "snapshot" ? "Refreshing…" : "Refresh"}
            </button>
          </form>
        )}

        <div className={styles.contextActions}>
          {selected && (
            <button
              type="button"
              className={styles.secondaryButton}
              data-action-id="discover.capture_repository_snapshot"
              disabled={pending !== null}
              onClick={() => void captureSnapshot()}
            >
              <RefreshCw aria-hidden="true" size={16} />
              {pending === "snapshot" ? "Refreshing" : "Refresh"}
            </button>
          )}
          {selected?.sourceUrl && (
            <a
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
              data-action-id="discover.open_repository"
            >
              Source <ExternalLink aria-hidden="true" />
            </a>
          )}
          {selected && (
            <button
              type="button"
              data-action-id="discover.start_mission"
              disabled={pending !== null}
              onClick={() => void startMission()}
            >
              <Sparkles aria-hidden="true" />
              {pending === "mission" ? "Opening…" : "Start Mission"}
            </button>
          )}
        </div>
      </div>

      {message && (
        <p className={message.kind === "success" ? styles.success : styles.error} role="status">
          {message.text}
        </p>
      )}

      <div className={styles.heading}>
        <div>
          <p>GitHub-backed coverage</p>
          <h2 id="github-funding-intelligence-title">Verified work inside the familiar Discover desk</h2>
        </div>
        <span><BadgeCheck aria-hidden="true" />{number.format(data.proof.persistedEvents)} persisted proof events</span>
      </div>

      <div className={styles.signalGrid}>
        <article>
          <div className={styles.cardTop}><CircleAlert aria-hidden="true" /><span>Unpaid Work</span></div>
          <strong>{number.format(data.recognitionSummary.uncoveredEvents)}</strong>
          <p>
            Accepted contribution events outside active funding policy across{" "}
            {number.format(data.recognitionSummary.contributorCount)} contributors.
          </p>
          <small>
            {data.recognitionSummary.amountUsd === null
              ? "No verified obligation amount"
              : `${usd.format(data.recognitionSummary.amountUsd)} recognition gap`}
          </small>
          {firstEvidence && (
            <Link
              href={`/api/discover/oss-evidence/${encodeURIComponent(firstEvidence.id)}`}
              target="_blank"
              data-action-id="discover.open_evidence"
            >
              View evidence <ExternalLink aria-hidden="true" />
            </Link>
          )}
        </article>

        <article>
          <div className={styles.cardTop}><Users aria-hidden="true" /><span>Contributors</span></div>
          <strong>{number.format(data.funding.eligibleRecipients)}</strong>
          <p>
            Eligible recipients. {number.format(data.funding.blockedRecipients)} still need verified
            identity or payout readiness.
          </p>
          {data.blockers[0] ? (
            <Link
              href={data.blockers[0].recoveryHref}
              data-action-id={data.blockers[0].code === "insufficient_funding"
                ? "capital.open_funding"
                : "discover.resolve_identity"}
            >
              {data.blockers[0].code === "insufficient_funding" ? "Review funding" : "Open contributor"}
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <span className={styles.readyLabel}>Attribution ready</span>
          )}
        </article>

        <article>
          <div className={styles.cardTop}><Landmark aria-hidden="true" /><span>Ready to Fund</span></div>
          <strong>{usd.format(data.funding.shortfallUsd)}</strong>
          <p>
            Funding still required across {number.format(data.funding.programCount)} active{" "}
            {data.funding.programCount === 1 ? "program" : "programs"}.
          </p>
          <small>
            Next checkpoint {data.funding.nextCheckpointUsd === null
              ? "complete"
              : usd.format(data.funding.nextCheckpointUsd)}
          </small>
          {firstPool && (
            <Link href={firstPool.fundingHref} data-action-id="capital.open_funding">
              Fund pool <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </article>

        <article>
          <div className={styles.cardTop}><BadgeCheck aria-hidden="true" /><span>Live Signals</span></div>
          <strong>{number.format(data.recentActivity.length)}</strong>
          <p>Recent verified GitHub activities from {selected?.fullName ?? "the selected repository"}.</p>
          <small>{data.proof.verificationState.replaceAll("_", " ")} · {data.proof.source}</small>
          {selected?.sourceUrl && (
            <a
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
              data-action-id="discover.open_repository"
            >
              Inspect source <ExternalLink aria-hidden="true" />
            </a>
          )}
        </article>
      </div>

      <div className={styles.poolHeading}>
        <div>
          <p>Pools</p>
          <h3>Community Pools with checkpoint and allocation visibility</h3>
        </div>
        <span>Communal funding · policy-routed recipients</span>
      </div>

      {data.pools.length > 0 ? (
        <div className={styles.poolGrid}>
          {data.pools.slice(0, 3).map((pool) => (
            <article key={pool.programId} className={styles.poolCard}>
              <div className={styles.poolIdentity}>
                <div>
                  <span>Community Pool</span>
                  <h4>{pool.programName}</h4>
                  <p>{pool.communitySlug}</p>
                </div>
                <strong>{usd.format(pool.poolBalanceUsd)}</strong>
              </div>
              <div
                className={styles.progress}
                role="progressbar"
                aria-label={`${pool.programName} checkpoint progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pool.progressToNextPct)}
              >
                <i style={{ width: `${pool.progressToNextPct}%` }} />
              </div>
              <dl>
                <div><dt>Available</dt><dd>{usd.format(pool.availableUsd)}</dd></div>
                <div><dt>Recognized work</dt><dd>{usd.format(pool.recognizedOwedUsd)}</dd></div>
                <div><dt>Next checkpoint</dt><dd>{pool.nextCheckpointUsd === null ? "Complete" : usd.format(pool.nextCheckpointUsd)}</dd></div>
                <div><dt>Contributors</dt><dd>{number.format(pool.contributorCount)}</dd></div>
              </dl>
              <p className={styles.poolTruth}>{pool.rationale}</p>
              <div className={styles.poolActions}>
                <Link href={pool.programHref} data-action-id="discover.open_program">View checkpoint</Link>
                <Link href={pool.programHref} data-action-id="discover.open_program">Review allocation</Link>
                <Link href={pool.fundingHref} data-action-id="capital.open_funding">
                  Open pool <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>
          No persisted Community Pool is attached to this repository. Discover won’t show a sample balance.
        </p>
      )}

      {firstOutcome && (
        <div className={styles.outcome}>
          <div>
            <BadgeCheck aria-hidden="true" />
            <span>
              <strong>Outcome receipt</strong>
              {usd.format(firstOutcome.totalUsd)} confirmed for {number.format(firstOutcome.payeeCount)}{" "}
              {firstOutcome.payeeCount === 1 ? "recipient" : "recipients"}
            </span>
          </div>
          <div>
            <Link
              href={`/outcomes/${encodeURIComponent(firstOutcome.publicReference)}`}
              data-action-id="receipt.open"
            >
              View receipt
            </Link>
            <a
              href={`https://testnet.arcscan.app/tx/${firstOutcome.txHash}`}
              target="_blank"
              rel="noreferrer"
              data-action-id="receipt.open_arcscan"
            >
              View transaction <ExternalLink aria-hidden="true" />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
