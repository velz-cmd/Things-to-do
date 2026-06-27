"use client";

export function MissionPlanningBar({
  visible,
  actions,
  onAction,
}: {
  visible: boolean;
  actions: { label: string; prompt: string }[];
  onAction: (prompt: string) => void;
}) {
  if (!visible || !actions.length) return null;

  return (
    <div className="sticky bottom-0 z-10 border-t border-resolve-border/60 bg-resolve-bg/95 px-4 py-4 backdrop-blur-md lg:px-6">
      <p className="mx-auto mb-3 max-w-2xl text-center text-[10px] uppercase tracking-wide text-resolve-muted-dim">
        Planning workspace
      </p>
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2">
        {actions.map((a, i) => (
          <button
            key={a.label}
            type="button"
            onClick={() => onAction(a.prompt)}
            className={
              i === 0 ?
                "min-w-[9rem] rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
              : "rounded-xl border border-resolve-border px-4 py-2.5 text-sm text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white"
            }
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MissionExecuteBar({
  visible,
  actions,
  onAction,
  onCancel,
}: {
  visible: boolean;
  actions: { label: string; prompt: string }[];
  onAction: (prompt: string) => void;
  onCancel?: () => void;
}) {
  if (!visible || !actions.length) return null;

  return (
    <div className="sticky bottom-0 z-10 border-t border-amber-500/20 bg-resolve-bg/95 px-4 py-4 backdrop-blur-md lg:px-6">
      <p className="mx-auto mb-3 max-w-2xl text-center text-[10px] uppercase tracking-wide text-amber-200/70">
        Ready to move capital
      </p>
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2">
        {actions.map((a, i) => (
          <button
            key={a.label}
            type="button"
            onClick={() => onAction(a.prompt)}
            className={
              i === actions.length - 1 ?
                "rounded-xl border border-resolve-accent/30 bg-resolve-accent/10 px-4 py-2.5 text-sm font-medium text-sky-200 transition hover:bg-resolve-accent/20"
              : i === 0 ?
                "min-w-[9rem] rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
              : "rounded-xl border border-resolve-border px-4 py-2.5 text-sm text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white"
            }
          >
            {a.label}
          </button>
        ))}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-3 py-2.5 text-sm text-resolve-muted-dim transition hover:text-white"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
