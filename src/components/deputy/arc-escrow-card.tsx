import { EscrowLock } from "@/components/escrow-lock";
import type { Task } from "@/lib/deputy/ui-types";
import { Card } from "@/components/ui";

export function ArcEscrowCard({
  task,
  onLocked,
}: {
  task: Task;
  onLocked: () => void;
}) {
  const netGain =
    task.recoveredUsd - task.executionCostUsd - task.successFeeUsd;

  return (
    <Card className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Arc escrow
      </p>
      <EscrowLock
        taskId={task.id}
        budgetUsd={task.budgetUsd}
        successFeeUsd={task.successFeeUsd}
        locked={task.escrowLocked}
        escrowTxHash={task.escrowTxHash}
        onLocked={onLocked}
      />
      {task.status === "settled" && (
        <div className="rounded-lg border border-deputy-accent/30 bg-deputy-accent/10 p-3">
          <p className="text-lg font-semibold text-deputy-accent">
            Net gain: +${netGain.toFixed(2)}
          </p>
          {task.settlementTxHash && (
            <a
              href={`https://testnet.arcscan.app/tx/${task.settlementTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-xs text-deputy-accent underline"
            >
              Settlement on Arcscan
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
