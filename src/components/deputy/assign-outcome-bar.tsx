import type { OutcomeTemplate } from "@/lib/deputy/ui-types";
import clsx from "clsx";

export function AssignOutcomeBar({
  templates,
  loading,
  onAssign,
}: {
  templates: OutcomeTemplate[];
  loading: boolean;
  onAssign: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Assign outcome
      </p>
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          disabled={loading}
          onClick={() => onAssign(t.id)}
          className={clsx(
            "w-full rounded-xl border border-deputy-border bg-deputy-panel p-4 text-left transition",
            "hover:border-deputy-accent/50 hover:bg-deputy-panel/80 disabled:opacity-50"
          )}
        >
          <p className="font-medium">{t.title}</p>
          <p className="mt-1 text-sm text-deputy-muted">{t.description}</p>
          <p className="mt-2 text-sm text-deputy-accent">
            Target ${t.targetValueUsd.toFixed(2)} · Success fee $0.20
          </p>
        </button>
      ))}
    </div>
  );
}
