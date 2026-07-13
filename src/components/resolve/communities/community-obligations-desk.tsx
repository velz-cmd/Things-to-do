"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, FileSearch, Fingerprint, Loader2, Radio, Route, ScrollText, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query/keys";
import styles from "./communities.module.css";

type ObligationRow = {
  id: string;
  payee: string;
  amountUsd: string;
  status: string;
  blockerCode: string | null;
  program: { id: string; name: string; version: number };
  policy: { id: string; version: number; contentHash: string } | null;
  identity: { id: string; canonicalRef: string; status: string } | null;
  payout: { id: string; network: string; address: string; status: string } | null;
  evidence: Array<{ id: string; kind: string; subjectRef: string; actorRef: string | null; occurredAt: string; contentHash: string; sourceUrl: string | null; confidencePpm: number }>;
  lineageHash: string;
  settlementBatchId: string | null;
  recognizedAt: string;
};

type Payload = { rows: ObligationRow[]; normalized: boolean };

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function fetchObligations(slug: string, signal?: AbortSignal): Promise<Payload> {
  const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/obligations`, { credentials: "include", cache: "no-store", signal });
  const data = (await response.json().catch(() => null)) as (Payload & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error ?? "Obligations could not be loaded");
  return data ?? { rows: [], normalized: false };
}

export function CommunityObligationsDesk({
  slug,
  filter,
  onFilter,
  onOpenIdentityDesk,
}: {
  slug: string;
  filter: "all" | "pending";
  onFilter: (filter: "all" | "pending") => void;
  onOpenIdentityDesk: () => void;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.communityObligations(slug),
    queryFn: ({ signal }) => fetchObligations(slug, signal),
    staleTime: 20_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });
  const [selected, setSelected] = useState<ObligationRow | null>(null);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

  const rows = (query.data?.rows ?? []).filter((row) =>
    filter === "all" ? true : !["settled", "claimed", "rejected"].includes(row.status),
  );

  async function review() {
    if (!selected || !query.data?.normalized) return;
    setReviewing(true);
    try {
      const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/obligations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Idempotency-Key": `obligation-review:${selected.id}` },
        body: JSON.stringify({ obligationId: selected.id, action: "review" }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Obligation review failed");
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: queryKeys.communitySurface(slug, "full") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.communities }),
      ]);
      toast.success("Obligation review recorded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Obligation review failed");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <section className={styles.tabPanel}>
      <div className={styles.tabIntro}>
        <div><p className={styles.sectionKicker}>Recognition ledger</p><h2>Obligations</h2><p>Every recognized amount remains traceable to evidence, identity, policy, and settlement state.</p></div>
        <div className={styles.segmented}>{(["all", "pending"] as const).map((item) => <button data-action-id="obligation.review" data-testid={`obligations-filter-${item}`} key={item} type="button" aria-pressed={filter === item} onClick={() => onFilter(item)}>{humanize(item)}</button>)}</div>
      </div>

      {query.isLoading ? <div className={styles.emptyState}><Loader2 className="animate-spin" /><p>Loading obligation lineage…</p></div>
      : query.isError ? <div className={styles.emptyState}><ScrollText /><p>{query.error instanceof Error ? query.error.message : "Obligations unavailable"}</p><button type="button" onClick={() => void query.refetch()}>Retry</button></div>
      : rows.length ? (
        <div className={styles.tableWrap}>
          <table><thead><tr><th>Payee</th><th>Evidence</th><th>Program</th><th>Recognized value</th><th>Identity</th><th>Readiness</th><th>Action</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}>
              <td><strong>{row.payee}</strong><span>{new Date(row.recognizedAt).toLocaleDateString()}</span></td>
              <td>{row.evidence.length} verified record{row.evidence.length === 1 ? "" : "s"}</td>
              <td>{row.program.name}<span>{row.program.version ? `Policy v${row.program.version}` : "Legacy policy"}</span></td>
              <td>${Number(row.amountUsd).toFixed(2)}</td>
              <td><span className={styles.tableStatus} data-state={row.identity ? "healthy" : "review"}>{row.identity ? "Resolved" : "Needs identity"}</span></td>
              <td>{humanize(row.status)}</td>
              <td><button data-action-id="obligation.open_evidence" data-testid={`obligation-evidence-${row.id}`} type="button" className={styles.tableLinkButton} onClick={() => setSelected(row)}><FileSearch /> View evidence</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : <div className={styles.emptyState}><ScrollText /><p>No obligations match this view. Synchronize sources to evaluate verified activity.</p><Link data-action-id="source.connect" href={`/profile?section=connections&returnTo=${encodeURIComponent(`/communities/${slug}`)}`}>Manage sources</Link></div>}

      {selected && (
        <div className={styles.drawerBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
          <aside className={styles.identityDrawer} role="dialog" aria-modal="true" aria-labelledby="obligation-drawer-title">
            <div className={styles.drawerHeader}><div><p className={styles.sectionKicker}>Proof lineage</p><h2 id="obligation-drawer-title">{selected.payee}</h2><p>${Number(selected.amountUsd).toFixed(2)} · {humanize(selected.status)}</p></div><button data-action-id="obligation.open_evidence" type="button" aria-label="Close obligation evidence" onClick={() => setSelected(null)}><X /></button></div>
            <div className={styles.drawerBody}>
              <section><h3>Source event → Evidence record</h3>{selected.evidence.map((evidence) => <div key={evidence.id} className={styles.lineageNode}><Radio /><div><strong>{humanize(evidence.kind)}</strong><span>{evidence.actorRef ?? "No actor reference"} · {(evidence.confidencePpm / 10_000).toFixed(0)}% confidence</span><code>{evidence.contentHash}</code></div></div>)}</section>
              <section><h3>Observed identity → Resolved identity</h3><div className={styles.lineageNode}><Fingerprint /><div><strong>{selected.identity?.canonicalRef ?? "Unresolved"}</strong><span>{selected.identity ? humanize(selected.identity.status) : selected.blockerCode ? humanize(selected.blockerCode) : "Review required"}</span></div></div></section>
              <section><h3>Policy version → Obligation</h3><div className={styles.lineageNode}><ShieldCheck /><div><strong>{selected.program.name} · {selected.policy ? `policy v${selected.policy.version}` : "legacy policy"}</strong><span>Obligation {selected.id}</span><code>{selected.policy?.contentHash ?? selected.lineageHash}</code></div></div></section>
              <section><h3>Settlement path</h3><div className={styles.lineageNode}><Route /><div><strong>{selected.settlementBatchId ? "Settlement attached" : "Not prepared"}</strong><span>{selected.payout ? `${selected.payout.network} · ${selected.payout.address}` : "Payout destination is not verified"}</span></div></div></section>
            </div>
            <div className={styles.drawerActions}>
              {!selected.identity && <button data-action-id="obligation.request_identity" data-testid="obligation-resolve-identity" type="button" className={styles.primaryButton} onClick={() => { setSelected(null); onOpenIdentityDesk(); }}><Fingerprint /> Resolve identity</button>}
              {query.data?.normalized && <button data-action-id="obligation.review" data-testid="obligation-review" type="button" className={styles.secondaryButton} disabled={reviewing} title={reviewing ? "Review is being recorded" : undefined} onClick={() => void review()}>{reviewing && <Loader2 className="animate-spin" />}Review obligation</button>}
              <Link data-action-id="program.update_policy" data-testid="obligation-open-policy" href={`/mission?community=${encodeURIComponent(slug)}&program=${encodeURIComponent(selected.program.id)}`} className={styles.secondaryButton}>Open policy</Link>
              <Link data-action-id="mission.simulate" data-testid="obligation-analyze-mission" href={`/mission?community=${encodeURIComponent(slug)}&program=${encodeURIComponent(selected.program.id)}&mode=simulate`} className={styles.secondaryButton}>Analyze in Mission <ArrowUpRight /></Link>
              {selected.identity && selected.payout && <Link data-action-id="obligation.prepare_settlement" data-testid="obligation-prepare-settlement" href={`/capital?community=${encodeURIComponent(slug)}&program=${encodeURIComponent(selected.program.id)}`} className={styles.primaryButton}>Prepare settlement</Link>}
              {selected.settlementBatchId && <Link data-action-id="receipt.open" data-testid="obligation-view-receipt" href={`/receipt/${encodeURIComponent(selected.settlementBatchId)}`} className={styles.secondaryButton}>View receipt</Link>}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
