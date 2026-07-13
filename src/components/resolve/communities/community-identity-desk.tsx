"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, Fingerprint, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query/keys";
import { profileConnectPath } from "@/lib/communities/community-nav";
import type { ResolveActionId } from "@/lib/actions/types";
import styles from "./communities.module.css";

type IdentityRow = {
  authorizationId: string;
  observedIdentityId: string | null;
  observedIdentity: string;
  externalRef: string;
  provider: string;
  payeeKeyType: string;
  suggestedMatch: string;
  confidencePpm: number;
  confidenceFactors: Record<string, unknown>;
  contradictingEvidence: unknown;
  evidenceIds: string[];
  recognizedAmountUsd: number;
  payoutDestinationId: string | null;
  status: string;
  candidateStatus: string;
  latestResolution: {
    action: string;
    method: string;
    resolvedBy: string;
    createdAt: string;
  } | null;
  claimStatus: string | null;
};

type IdentityPayload = { rows: IdentityRow[] };
type IdentityOperation =
  | "confirm_match"
  | "reject_match"
  | "request_creator_confirmation"
  | "claim"
  | "defer";

const actionIdByOperation: Record<IdentityOperation, ResolveActionId> = {
  confirm_match: "identity.confirm_match",
  reject_match: "identity.reject_match",
  request_creator_confirmation: "identity.request_creator_confirmation",
  claim: "identity.claim",
  defer: "identity.defer",
};

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function fetchIdentities(slug: string, signal?: AbortSignal): Promise<IdentityPayload> {
  const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/identities`, {
    credentials: "include",
    cache: "no-store",
    signal,
  });
  const data = (await response.json().catch(() => null)) as (IdentityPayload & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error ?? "Identity records could not be loaded");
  return data ?? { rows: [] };
}

export function CommunityIdentityDesk({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.communityIdentities(slug),
    queryFn: ({ signal }) => fetchIdentities(slug, signal),
    staleTime: 20_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });
  const [selected, setSelected] = useState<IdentityRow | null>(null);
  const [pending, setPending] = useState<IdentityOperation | null>(null);

  useEffect(() => {
    setSelected((current) => {
      if (!current) return current;
      return query.data?.rows.find((row) => row.authorizationId === current.authorizationId) ?? current;
    });
  }, [query.data]);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

  async function operate(operation: IdentityOperation) {
    if (!selected) return;
    setPending(operation);
    try {
      const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/identities`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `identity:${selected.authorizationId}:${operation}`,
        },
        body: JSON.stringify({
          authorizationId: selected.authorizationId,
          action: operation,
          candidateRef: selected.suggestedMatch,
          evidenceIds: selected.evidenceIds,
          humanConfirmed: operation === "confirm_match",
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Identity operation failed");
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: queryKeys.communitySurface(slug, "full") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.communities }),
      ]);
      toast.success(
        operation === "confirm_match"
          ? "Identity match confirmed"
          : operation === "claim"
            ? "Identity claim submitted for review"
            : `${humanize(operation)} recorded`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Identity operation failed");
    } finally {
      setPending(null);
    }
  }

  const rows = query.data?.rows ?? [];
  return (
    <section className={styles.tabPanel}>
      <div className={styles.tabIntro}>
        <div>
          <p className={styles.sectionKicker}>Communities-native resolution</p>
          <h2>Identity Resolution Desk</h2>
          <p>Review source evidence and human-confirm payout identities before obligations advance.</p>
        </div>
        <Link
          data-action-id="identity.set_payout_destination"
          data-testid="identity-link-payout"
          href={profileConnectPath(`/communities/${slug}`)}
          className={styles.secondaryButton}
        >
          Manage payout identities <ArrowUpRight />
        </Link>
      </div>

      {query.isLoading ? (
        <div className={styles.emptyState}><Loader2 className="animate-spin" /><p>Loading observed identities…</p></div>
      ) : query.isError ? (
        <div className={styles.emptyState}>
          <Fingerprint />
          <p>{query.error instanceof Error ? query.error.message : "Identity records are unavailable."}</p>
          <button type="button" onClick={() => void query.refetch()}>Retry</button>
        </div>
      ) : rows.length ? (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Observed identity</th>
                <th>Suggested match</th>
                <th>Confidence</th>
                <th>Evidence</th>
                <th>Payout destination</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.authorizationId}>
                  <td><strong>{row.observedIdentity}</strong><span>{humanize(row.provider)}</span></td>
                  <td>{row.suggestedMatch}</td>
                  <td>{(row.confidencePpm / 10_000).toFixed(0)}%</td>
                  <td>{row.evidenceIds.length} proof reference{row.evidenceIds.length === 1 ? "" : "s"}</td>
                  <td>{row.payoutDestinationId ? "Linked" : "Not linked"}</td>
                  <td><span className={styles.tableStatus} data-state={row.status === "resolved" ? "healthy" : "review"}>{humanize(row.status)}</span></td>
                  <td>
                    <button
                      data-action-id="identity.inspect"
                      data-testid={`identity-inspect-${row.authorizationId}`}
                      type="button"
                      className={styles.tableLinkButton}
                      onClick={() => setSelected(row)}
                    >
                      <Search /> Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Fingerprint />
          <p>No observed identities are waiting for resolution. Synchronize a source to detect evidence.</p>
          <Link data-action-id="source.connect" href={profileConnectPath(`/communities/${slug}`)}>Manage connections</Link>
        </div>
      )}

      {selected && (
        <div className={styles.drawerBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setSelected(null);
        }}>
          <aside className={styles.identityDrawer} role="dialog" aria-modal="true" aria-labelledby="identity-drawer-title">
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.sectionKicker}>Resolution review</p>
                <h2 id="identity-drawer-title">{selected.observedIdentity}</h2>
                <p>{humanize(selected.provider)} · ${(selected.recognizedAmountUsd).toFixed(2)} recognized</p>
              </div>
              <button data-action-id="identity.inspect" data-testid="identity-close-drawer" type="button" aria-label="Close identity review" onClick={() => setSelected(null)}><X /></button>
            </div>

            <div className={styles.drawerBody}>
              <section>
                <h3>Observed source records</h3>
                <dl><div><dt>External reference</dt><dd>{selected.externalRef}</dd></div><div><dt>Type</dt><dd>{humanize(selected.payeeKeyType)}</dd></div></dl>
              </section>
              <section>
                <h3>Candidate identity</h3>
                <dl><div><dt>Suggested match</dt><dd>{selected.suggestedMatch}</dd></div><div><dt>Confidence</dt><dd>{(selected.confidencePpm / 10_000).toFixed(1)}% · advisory only</dd></div></dl>
                <p className={styles.drawerNote}>A confidence score never finalizes a financially significant match. Confirmation below is recorded as human review.</p>
              </section>
              <section>
                <h3>Matching explanation</h3>
                <ul className={styles.factorList}>{Object.entries(selected.confidenceFactors).map(([key, value]) => <li key={key}><CheckCircle2 /> {humanize(key)}: {String(value)}</li>)}</ul>
                {selected.contradictingEvidence ? <p className={styles.drawerNote}>Contradicting evidence: {JSON.stringify(selected.contradictingEvidence)}</p> : <p className={styles.drawerNote}>No contradicting evidence is recorded.</p>}
              </section>
              <section>
                <h3>Proof lineage and program impact</h3>
                <p>{selected.evidenceIds.length} evidence reference{selected.evidenceIds.length === 1 ? "" : "s"} support this observed identity. Resolving it can unlock ${selected.recognizedAmountUsd.toFixed(2)} for policy review.</p>
                <div className={styles.proofRefs}>{selected.evidenceIds.map((id) => <code key={id}>{id}</code>)}</div>
              </section>
              <section>
                <h3>Payout destination and claims</h3>
                <dl><div><dt>Destination</dt><dd>{selected.payoutDestinationId ?? "Not linked"}</dd></div><div><dt>Claim</dt><dd>{selected.claimStatus ? humanize(selected.claimStatus) : "No claim"}</dd></div></dl>
              </section>
            </div>

            <div className={styles.drawerActions}>
              {([
                ["confirm_match", "Confirm match"],
                ["reject_match", "Reject match"],
                ["request_creator_confirmation", "Request creator confirmation"],
                ["claim", "Claim this identity"],
                ["defer", "Defer"],
              ] as const).map(([operation, label]) => (
                <button
                  key={operation}
                  data-action-id={actionIdByOperation[operation]}
                  data-testid={`identity-${operation}`}
                  type="button"
                  className={operation === "confirm_match" ? styles.primaryButton : styles.secondaryButton}
                  disabled={pending !== null || (operation === "confirm_match" && selected.status === "resolved")}
                  title={operation === "confirm_match" && selected.status === "resolved" ? "This identity is already resolved" : undefined}
                  onClick={() => void operate(operation)}
                >
                  {pending === operation && <Loader2 className="animate-spin" />}{label}
                </button>
              ))}
              <Link data-action-id="identity.submit_proof" data-testid="identity-submit-evidence" href={`/profile?section=identity&returnTo=${encodeURIComponent(`/communities/${slug}`)}`} className={styles.secondaryButton}>Submit evidence</Link>
              <Link data-action-id="identity.set_payout_destination" data-testid="identity-set-payout" href={`/profile?section=payouts&returnTo=${encodeURIComponent(`/communities/${slug}`)}`} className={styles.secondaryButton}>Link payout account</Link>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
