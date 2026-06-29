"use client";

import type { CapabilityAction } from "@/lib/mission/capabilities/types";

export function MissionPlanningBar({
  visible,
  actions,
  onAction,
}: {
  visible: boolean;
  actions: CapabilityAction[];
  onAction: (action: CapabilityAction) => void;
}) {
  if (!visible || !actions.length) return null;

  return (
    <div className="mx-auto mb-3 max-w-2xl">
      <p className="mb-2 text-center text-[10px] uppercase tracking-wide text-resolve-muted-dim">
        Planning workspace
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {actions.map((a, i) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onAction(a)}
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
  executeBlocked,
  blockReason,
}: {
  visible: boolean;
  actions: CapabilityAction[];
  onAction: (action: CapabilityAction) => void;
  onCancel?: () => void;
  executeBlocked?: boolean;
  blockReason?: string;
}) {
  if (!visible || !actions.length) return null;

  return (
    <div className="mx-auto mb-3 max-w-2xl">
      <p className="mb-2 text-center text-[10px] uppercase tracking-wide text-amber-200/70">
        Ready to move capital
      </p>
      {executeBlocked && blockReason && (
        <p className="mb-2 text-center text-[11px] text-amber-200/90">{blockReason}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {actions.map((a, i) => {
          const isExecute =
            a.actionType === "execute_settlement" || a.actionType === "prepare_settlement";
          const disabled = executeBlocked && isExecute;
          return (
            <button
              key={a.id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onAction(a)}
              className={
                disabled
                  ? "cursor-not-allowed rounded-xl border border-white/10 px-4 py-2.5 text-sm text-resolve-muted-dim opacity-50"
                  : a.actionType === "execute_settlement" || i === actions.length - 1
                    ? "rounded-xl border border-resolve-accent/30 bg-resolve-accent/10 px-4 py-2.5 text-sm font-medium text-sky-200 transition hover:bg-resolve-accent/20"
                    : i === 0
                      ? "min-w-[9rem] rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
                      : "rounded-xl border border-resolve-border px-4 py-2.5 text-sm text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white"
              }
            >
              {a.label}
            </button>
          );
        })}
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
