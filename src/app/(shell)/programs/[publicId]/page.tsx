import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, ArrowUpRight, BadgeCheck, FileKey2, Radio, Scale, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { ARC_TESTNET_EXPLORER_URL } from "@/lib/arc/config";
import styles from "./program-passport.module.css";

type Props = { params: Promise<{ publicId: string }> };

async function getPublicProgram(publicId: string) {
  const program = await prisma.resolveProgram.findFirst({
    where: { id: publicId, status: { in: ["active", "deployed"] } },
    include: { install: { select: { communitySlug: true } } },
  });
  if (!program) return null;
  const version = await prisma.programVersion.findFirst({
    where: { programId: program.id },
    orderBy: { version: "desc" },
  });
  const policy = version
    ? await prisma.policyVersion.findFirst({ where: { programVersionId: version.id }, orderBy: { version: "desc" } })
    : null;
  const [obligations, legacyAuthorizations, settlement, activity] = await Promise.all([
    version
      ? prisma.obligation.findMany({ where: { programVersionId: version.id }, select: { id: true, status: true, evidenceIds: true, lineageHash: true } })
      : [],
    program.missionId
      ? prisma.paymentAuthorization.findMany({ where: { missionId: program.missionId }, select: { id: true, status: true, proofHash: true } })
      : [],
    program.lastSettlementId
      ? prisma.missionSettlement.findUnique({
          where: { id: program.lastSettlementId },
          include: { intents: { select: { txHash: true, status: true } } },
        })
      : null,
    prisma.operationalEvent.findMany({
      where: { aggregateType: "program", aggregateId: program.id },
      orderBy: { occurredAt: "desc" },
      take: 12,
      select: { id: true, eventType: true, occurredAt: true },
    }),
  ]);
  return { program, version, policy, obligations, legacyAuthorizations, settlement, activity };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const data = await getPublicProgram(publicId);
  if (!data) return { title: "Program Passport — RESOLVE" };
  return {
    title: `${data.program.name} · Program Passport — RESOLVE`,
    description: `Privacy-safe operational proof for ${data.program.name}.`,
  };
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function ProgramPassportPage({ params }: Props) {
  const { publicId } = await params;
  const data = await getPublicProgram(publicId);
  if (!data) notFound();
  const { program, version, policy, obligations, legacyAuthorizations, settlement, activity } = data;
  const community = getCommunityBySlug(program.install.communitySlug);
  const rules = (() => {
    try { return JSON.parse(program.rulesJson) as Record<string, unknown>; } catch { return {}; }
  })();
  const obligationCount = obligations.length || legacyAuthorizations.length;
  const evidenceBacked = obligations.length
    ? obligations.filter((row) => row.evidenceIds.length > 0).length
    : legacyAuthorizations.filter((row) => Boolean(row.proofHash)).length;
  const evidenceCoverage = obligationCount > 0 ? Math.round((evidenceBacked / obligationCount) * 100) : null;
  const txHashes = settlement?.intents.flatMap((intent) => intent.txHash && /^0x[a-fA-F0-9]{64}$/.test(intent.txHash) ? [intent.txHash] : []) ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.grid} aria-hidden />
      <div className={styles.frame}>
        <Link href={`/communities/${encodeURIComponent(program.install.communitySlug)}`} className={styles.back}><ArrowLeft /> Community console</Link>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}><BadgeCheck /> Public program passport</p>
            <h1>{program.name}</h1>
            <p>{community?.name ?? humanize(program.install.communitySlug)} · {community?.tagline ?? "Operational value program"}</p>
          </div>
          <div className={styles.status} data-status={program.status}><i />{humanize(program.status)}</div>
        </header>

        <section className={styles.proofRail} aria-label="Program proof summary">
          <div><span>Policy version</span><strong>{version ? `v${version.version}` : "Legacy policy"}</strong></div>
          <div><span>Obligations</span><strong>{obligationCount}</strong></div>
          <div><span>Evidence coverage</span><strong>{evidenceCoverage === null ? "No obligations" : `${evidenceCoverage}%`}</strong></div>
          <div><span>Settlements</span><strong>{settlement ? 1 : 0}</strong></div>
        </section>

        <div className={styles.layout}>
          <section className={styles.surface}>
            <div className={styles.heading}><div><p>Policy architecture</p><h2>How value is recognized</h2></div><Scale /></div>
            <dl className={styles.policyGrid}>
              <div><dt>Purpose</dt><dd>{community?.doctrine ?? program.name}</dd></div>
              <div><dt>Source types</dt><dd>{String(rules.connectorId ?? community?.connectors.join(" · ") ?? "Configured evidence")}</dd></div>
              <div><dt>Recognition window</dt><dd>{String((version?.snapshot as Record<string, unknown> | null)?.recognitionWindow ?? "Policy-defined")}</dd></div>
              <div><dt>Eligibility</dt><dd>{policy ? "Resolved identity · verified evidence" : "Program rules"}</dd></div>
            </dl>
            {policy && <div className={styles.hash}><FileKey2 /><div><span>Policy content hash</span><code>{policy.contentHash}</code></div></div>}
          </section>

          <aside className={styles.surface}>
            <div className={styles.heading}><div><p>Verification</p><h2>Public trust record</h2></div><ShieldCheck /></div>
            <ul className={styles.checks}>
              <li><BadgeCheck /><span>Program state</span><strong>{humanize(program.status)}</strong></li>
              <li><Radio /><span>Evidence lineage</span><strong>{evidenceBacked} records</strong></li>
              <li><FileKey2 /><span>Receipt hash</span><strong>{settlement?.proofHash ? "Published" : "Not settled"}</strong></li>
            </ul>
            {settlement?.proofHash && <code className={styles.receiptHash}>{settlement.proofHash}</code>}
          </aside>
        </div>

        <section className={styles.surface}>
          <div className={styles.heading}><div><p>Settlement history</p><h2>Arc receipts and confirmations</h2></div><ArrowUpRight /></div>
          {settlement ? (
            <div className={styles.settlement}>
              <div><span>Status</span><strong>{humanize(settlement.status)}</strong></div>
              <div><span>Payee count</span><strong>{settlement.intents.length}</strong></div>
              <div><span>Proof reference</span><code>{settlement.proofHash}</code></div>
              <div className={styles.txLinks}>{txHashes.length ? txHashes.map((hash) => <a key={hash} href={`${ARC_TESTNET_EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noopener noreferrer">ArcScan {hash.slice(0, 10)}… <ArrowUpRight /></a>) : <span>No confirmed on-chain transaction is published.</span>}</div>
            </div>
          ) : <p className={styles.empty}>No settlement receipt exists yet. This page will only publish Arc links after a confirmed transaction is recorded.</p>}
        </section>

        <section className={styles.surface}>
          <div className={styles.heading}><div><p>Program activity</p><h2>Immutable operational events</h2></div><Activity /></div>
          {activity.length ? <ol className={styles.activity}>{activity.map((event) => <li key={event.id}><i /><div><strong>{humanize(event.eventType)}</strong><time>{event.occurredAt.toLocaleString()}</time></div></li>)}</ol> : <p className={styles.empty}>No normalized public program events have been recorded yet.</p>}
        </section>

        <p className={styles.privacy}>Privacy-safe view · creator emails, source credentials, private evidence, wallet secrets, and unpublished contributor details are never exposed.</p>
      </div>
    </main>
  );
}
