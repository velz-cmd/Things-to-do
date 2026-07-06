"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { Money } from "@/components/resolve/ui/money";

type PayeeRow = { label: string; owedUsd: number };

type PoolBatchPayeeCompactProps = {
  payees: PayeeRow[];
  ceilingUsd: number;
  payeeCategory?: string;
  className?: string;
};

/** Collapsible batch payee list — compact summary, expand for full queue. */
export function PoolBatchPayeeCompact({
  payees,
  ceilingUsd,
  payeeCategory = "creators",
  className,
}: PoolBatchPayeeCompactProps) {
  const [open, setOpen] = useState(false);
  if (!payees.length) return null;

  const totalUsd = payees.reduce((s, p) => s + p.owedUsd, 0);
  const preview = payees.slice(0, 3);
  const rest = payees.length - preview.length;

  return (
    <div className={clsx("mt-2 rounded-lg border border-white/[0.06] bg-black/20", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0 text-[10px] font-medium text-resolve-muted">
          <span className="text-white/90">
            {payees.length} {payeeCategory}
          </span>
          {" · "}
          <Money amount={totalUsd} size="sm" className="inline text-amber-200/90" />
          {" at "}${ceilingUsd.toLocaleString()} checkpoint
        </span>
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 shrink-0 text-resolve-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {!open && (
        <p className="border-t border-white/[0.04] px-3 py-1.5 text-[9px] leading-relaxed text-resolve-muted-dim">
          {preview.map((p, i) => (
            <span key={p.label}>
              {i > 0 ? " · " : ""}
              <span className="text-white/80">{p.label}</span>{" "}
              <Money amount={p.owedUsd} size="sm" className="inline text-amber-100/80" />
            </span>
          ))}
          {rest > 0 ? <span className="text-resolve-muted"> · +{rest} more</span> : null}
        </p>
      )}

      {open && (
        <ul className="max-h-24 space-y-0.5 overflow-y-auto border-t border-white/[0.04] px-3 py-2">
          {payees.slice(0, 12).map((payee) => (
            <li key={payee.label} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="truncate text-white/90">{payee.label}</span>
              <Money amount={payee.owedUsd} size="sm" className="shrink-0 text-amber-100/90" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
