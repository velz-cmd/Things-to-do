"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Task } from "@/lib/deputy/ui-types";
import { taskStatusLabel } from "@/lib/resolve/progress";

export default function ApprovalsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const load = () =>
      fetch("/api/tasks")
        .then((r) => r.json())
        .then((d) => setTasks(d.tasks ?? []));
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const pending = tasks.filter((t) =>
    ["needs_attention", "escalated", "proof_pending"].includes(t.status)
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="mt-1 text-sm text-deputy-muted">Actions that need your permission</p>
      </header>

      {pending.length === 0 ? (
        <p className="rounded-xl border border-deputy-border bg-deputy-panel p-6 text-center text-deputy-muted">
          No approvals needed
        </p>
      ) : (
        <ul className="space-y-3">
          {pending.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
            >
              <p className="font-medium">{t.title}</p>
              <p className="text-sm text-deputy-muted">{taskStatusLabel(t.status)}</p>
              {t.attentionReason && (
                <p className="mt-2 text-sm text-amber-100">{t.attentionReason}</p>
              )}
              <Link
                href={`/missions/${t.id}`}
                className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
              >
                Review & approve
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
