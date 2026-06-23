"use client";

import { OUTCOME_EXAMPLES } from "@/lib/resolve/progress";
import clsx from "clsx";

export function OutcomeInput({
  loading,
  onAssign,
}: {
  loading: boolean;
  onAssign: (templateId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-deputy-border bg-deputy-panel p-6">
      <label className="text-sm font-medium text-deputy-muted">
        What outcome do you want?
      </label>
      <div className="mt-3 rounded-xl border border-deputy-border bg-deputy-bg px-4 py-3 text-deputy-muted">
        Recover my delayed parcel compensation…
      </div>
      <p className="mt-4 text-xs uppercase tracking-wide text-deputy-muted">
        Examples — tap to assign
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {OUTCOME_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            disabled={loading || !ex.templateId}
            onClick={() => ex.templateId && onAssign(ex.templateId)}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-sm transition",
              ex.templateId
                ? "border-deputy-accent/40 text-deputy-accent hover:bg-deputy-accent/10"
                : "cursor-not-allowed border-deputy-border text-deputy-muted opacity-50"
            )}
          >
            {ex.label}
            {!ex.templateId && " (soon)"}
          </button>
        ))}
      </div>
    </section>
  );
}
