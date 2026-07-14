"use client";

import { Ellipsis, Sparkles } from "lucide-react";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";

/** Context-emergent actions — Elsa-style pills with sparkle affordance. */
export function MissionCapabilityActions({
  actions,
  onAction,
  disabled,
}: {
  actions: CapabilityAction[];
  onAction: (action: CapabilityAction) => void;
  disabled?: boolean;
}) {
  if (!actions.length) return null;
  const primaryActions = actions.slice(0, 2);
  const overflowActions = actions.slice(2);

  function actionButton(action: CapabilityAction) {
    return (
      <button
        key={action.id}
        type="button"
        disabled={disabled}
        onClick={() => onAction(action)}
        className="mission-capability-action"
      >
        <Sparkles className="h-3 w-3 shrink-0 text-resolve-accent/80" />
        {action.label}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
        Next steps
      </p>
      <div className="mission-capability-actions">
        {primaryActions.map(actionButton)}
        {overflowActions.length > 0 && (
          <details className="mission-capability-more">
            <summary><Ellipsis className="h-3.5 w-3.5" /> More</summary>
            <div>{overflowActions.map(actionButton)}</div>
          </details>
        )}
      </div>
    </div>
  );
}
