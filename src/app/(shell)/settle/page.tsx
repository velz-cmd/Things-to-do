"use client";

import { useEffect, useState } from "react";
import { SettlementPanel } from "@/components/settlement/settlement-panel";
import type { Task } from "@/lib/deputy/ui-types";
import { PageHeader } from "@/components/resolve/ui/page-header";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import Link from "next/link";

export default function SettlePage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []));
  }, []);

  const withEscrow = tasks.filter((t) => t.escrowLocked || t.status !== "created");

  return (
    <div className="resolve-grid-bg mx-auto max-w-3xl space-y-6 px-4 py-8 lg:px-8">
      <PageHeader
        title="Settle"
        subtitle="Proof-based payment. Your task budget stays locked until verified proof exists."
      />

      {withEscrow.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <p className="text-resolve-muted">No escrow activity yet.</p>
          <p className="mt-2 text-sm text-resolve-muted">
            Start a mission and lock your task budget when ready.
          </p>
          <Link href="/start" className="mt-4 inline-block text-sm font-medium text-sky-400 hover:underline">
            Start a task →
          </Link>
        </GlassPanel>
      ) : (
        withEscrow.map((t) => (
          <GlassPanel key={t.id} className="space-y-3 p-5">
            <p className="font-medium text-white">{t.title}</p>
            <SettlementPanel taskId={t.id} budgetUsd={t.budgetUsd} />
          </GlassPanel>
        ))
      )}
    </div>
  );
}
