"use client";

import { useEffect, useState } from "react";
import { SettlementPanel } from "@/components/settlement/settlement-panel";
import type { Task } from "@/lib/deputy/ui-types";

export default function SettlementPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []));
  }, []);

  const withEscrow = tasks.filter((t) => t.escrowLocked || t.status !== "created");

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Settlement</h1>
        <p className="mt-1 text-sm text-deputy-muted">
          Arc escrow status — only verified transactions show as locked or released
        </p>
      </header>

      {withEscrow.length === 0 ? (
        <p className="text-sm text-deputy-muted">
          No escrow activity yet. Lock Arc task budget from a mission to begin.
        </p>
      ) : (
        withEscrow.map((t) => (
          <div key={t.id} className="space-y-2">
            <p className="text-sm font-medium">{t.title}</p>
            <SettlementPanel taskId={t.id} budgetUsd={t.budgetUsd} />
          </div>
        ))
      )}
    </div>
  );
}
