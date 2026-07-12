"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { Money } from "@/components/resolve/ui/money";
import styles from "./discover-workspace.module.css";

type PayeeRow = { label: string; owedUsd: number };

type PoolBatchPayeeCompactProps = {
  payees: PayeeRow[];
  ceilingUsd: number;
  payeeCategory?: string;
  className?: string;
};

function initials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Structured contributor rail with a screen-reader-safe expanded list. */
export function PoolBatchPayeeCompact({
  payees,
  ceilingUsd,
  payeeCategory = "creators",
  className,
}: PoolBatchPayeeCompactProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (!payees.length) return null;

  const totalUsd = payees.reduce((sum, payee) => sum + payee.owedUsd, 0);
  const preview = payees.slice(0, 3);
  const rest = payees.length - preview.length;

  return (
    <div className={clsx(styles.payeePanel, className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={clsx(styles.payeeToggle, "flex w-full items-center justify-between gap-3 text-left")}
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className="text-[10px] text-resolve-muted">
          <strong className="font-semibold text-white">{payees.length} {payeeCategory}</strong>
          <span aria-hidden="true"> · </span>
          <Money amount={totalUsd} size="sm" className="inline text-amber-200" /> allocated at the ${ceilingUsd.toLocaleString()} checkpoint
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-blue-300">
          {open ? "Collapse" : rest > 0 ? `View all +${rest}` : "View allocation"}
          <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {!open && (
        <div className={styles.payeePreview} aria-label="Contributor allocation preview">
          {preview.map((payee) => (
            <div key={payee.label} className={styles.payeePreviewRow}>
              <span className={styles.payeeInitial} aria-hidden="true">{initials(payee.label)}</span>
              <span className="truncate">{payee.label}</span>
              <Money amount={payee.owedUsd} size="sm" className={styles.payeeAmount} />
            </div>
          ))}
        </div>
      )}

      {open && (
        <ul id={listId} className={styles.payeeExpanded} aria-label="Contributor allocations">
          {payees.slice(0, 12).map((payee) => (
            <li key={payee.label} className={styles.payeeRow}>
              <span className={styles.payeeInitial} aria-hidden="true">{initials(payee.label)}</span>
              <span className="truncate">{payee.label}</span>
              <Money amount={payee.owedUsd} size="sm" className={styles.payeeAmount} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
