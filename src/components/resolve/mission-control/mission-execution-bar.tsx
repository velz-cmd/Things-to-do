"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";

export function MissionExecutionBar({
  visible,
  onApprove,
  onSimulate,
  onReject,
  fundHref = "/capital",
}: {
  visible: boolean;
  onApprove?: () => void;
  onSimulate?: () => void;
  onReject?: () => void;
  fundHref?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!visible) return null;

  return (
    <div className="sticky bottom-0 z-10 border-t border-resolve-border/60 bg-resolve-bg/95 px-4 py-4 backdrop-blur-md lg:px-6">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onApprove}
          className="min-w-[7rem] rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-xl border border-resolve-border px-4 py-2.5 text-sm text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onSimulate}
          className="rounded-xl border border-resolve-border px-4 py-2.5 text-sm text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white"
        >
          Simulate
        </button>
        <Link
          href={fundHref}
          className="rounded-xl border border-resolve-accent/30 bg-resolve-accent/10 px-4 py-2.5 text-sm font-medium text-sky-200 transition hover:bg-resolve-accent/20"
        >
          Execute
        </Link>
        <button
          type="button"
          onClick={onReject}
          className="rounded-xl px-3 py-2.5 text-sm text-resolve-muted-dim transition hover:text-white"
        >
          Cancel
        </button>
      </div>

      {editing && (
        <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-resolve-muted">
          Tell RESOLVE how to adjust the allocation — e.g. &ldquo;move $10k to React Router&rdquo; or
          &ldquo;use a conservative split.&rdquo;
        </p>
      )}
    </div>
  );
}

export function MissionQuickReplies({
  options,
  onSelect,
  disabled,
  className,
}: {
  options: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (!options.length) return null;

  return (
    <div className={clsx("flex flex-wrap gap-2", className)}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(opt)}
          className="rounded-full border border-resolve-border/70 px-3 py-1.5 text-xs text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white disabled:opacity-40"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
