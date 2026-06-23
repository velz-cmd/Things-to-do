"use client";

import type { Proof, Task } from "@/lib/deputy/ui-types";
import { useEffect, useState } from "react";

type VerifiedTx = {
  hash: string;
  label: string;
  verified: boolean;
};

async function verifyHash(hash: string): Promise<boolean> {
  const res = await fetch(`/api/settlement/verify-tx/${hash}`);
  const data = await res.json();
  return Boolean(data.verification?.found && data.verification?.success);
}

export function EvidencePanel({
  proofs,
  task,
}: {
  proofs: Proof[];
  task: Task;
}) {
  const [verifiedTxs, setVerifiedTxs] = useState<VerifiedTx[]>([]);

  useEffect(() => {
    async function load() {
      const candidates: { hash: string; label: string }[] = [];
      if (task.escrowTxHash) {
        candidates.push({ hash: task.escrowTxHash, label: "Escrow lock" });
      }
      if (task.settlementTxHash) {
        candidates.push({ hash: task.settlementTxHash, label: "Settlement" });
      }
      for (const mp of task.microPayments ?? []) {
        if (mp.txHash) {
          candidates.push({ hash: mp.txHash, label: mp.purpose });
        }
      }

      const out: VerifiedTx[] = [];
      for (const c of candidates) {
        const verified = await verifyHash(c.hash);
        out.push({ ...c, verified });
      }
      setVerifiedTxs(out);
    }
    void load();
  }, [task.escrowTxHash, task.settlementTxHash, task.microPayments]);

  const items: { label: string; value: string; href?: string; pending?: boolean }[] =
    [];

  for (const p of proofs) {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(p.payload);
    } catch {
      /* ignore */
    }
    items.push({
      label: p.type.replace(/_/g, " "),
      value: String(payload.confirmationId ?? p.contentHash.slice(0, 16) + "…"),
      href: p.artifactUrl ?? undefined,
    });
  }

  for (const e of task.events) {
    const lower = e.message.toLowerCase();
    if (
      lower.includes("email") ||
      lower.includes("ticket") ||
      lower.includes("booking") ||
      lower.includes("receipt") ||
      lower.includes("submitted")
    ) {
      items.push({
        label: e.agent,
        value: e.message.length > 48 ? e.message.slice(0, 48) + "…" : e.message,
      });
    }
  }

  for (const mp of task.microPayments ?? []) {
    items.push({
      label: mp.purpose,
      value: `$${mp.amountUsd.toFixed(3)} (offchain metered)`,
    });
  }

  for (const vtx of verifiedTxs) {
    items.push({
      label: vtx.label,
      value: vtx.verified
        ? vtx.hash.slice(0, 18) + "…"
        : "Pending / not on Arc",
      href: vtx.verified
        ? `https://testnet.arcscan.app/tx/${vtx.hash}`
        : undefined,
      pending: !vtx.verified,
    });
  }

  if (task.proofHash) {
    items.push({
      label: "Proof hash",
      value: task.proofHash.slice(0, 18) + "…",
    });
  }

  const placeholders = [
    "Email confirmations",
    "PDF receipts",
    "Verified Arc transactions only",
    "Support tickets",
    "Screenshots",
  ];

  return (
    <section className="rounded-xl border border-deputy-border bg-deputy-panel p-5">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Evidence
      </h2>
      {items.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {placeholders.map((p) => (
            <span
              key={p}
              className="rounded-full border border-dashed border-deputy-border px-3 py-1 text-xs text-deputy-muted"
            >
              {p}
            </span>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={`${item.label}-${i}`}
              className="flex items-center justify-between rounded-lg bg-deputy-bg/60 px-3 py-2 text-sm"
            >
              <span className="text-deputy-muted">{item.label}</span>
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-deputy-accent underline"
                >
                  {item.value}
                </a>
              ) : (
                <span
                  className={`font-mono text-xs ${item.pending ? "text-deputy-warn" : ""}`}
                >
                  {item.value}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
