"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Task } from "@/lib/deputy/ui-types";
import { taskStatusLabel } from "@/lib/resolve/progress";
import { PageHeader } from "@/components/resolve/ui/page-header";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";

export default function ReviewPage() {
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
    <div className="resolve-grid-bg mx-auto max-w-3xl space-y-6 px-4 py-8 lg:px-8">
      <PageHeader
        title="Review"
        subtitle="Actions waiting for your approval."
      />

      {pending.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <p className="text-resolve-muted">No approvals needed.</p>
          <p className="mt-2 text-sm text-resolve-muted">
            RESOLVE will ask here before risky submissions, wallet moves, or human escalation.
          </p>
        </GlassPanel>
      ) : (
        <ul className="space-y-3">
          {pending.map((t) => (
            <GlassPanel key={t.id} className="border-amber-500/20 p-5">
              <p className="font-medium text-white">{t.title}</p>
              <p className="text-sm text-resolve-muted">{taskStatusLabel(t.status)}</p>
              {t.attentionReason && (
                <p className="mt-2 text-sm text-amber-100">{t.attentionReason}</p>
              )}
              <Link
                href={`/missions/${t.id}`}
                className="mt-4 inline-block rounded-full bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
              >
                Review & approve
              </Link>
            </GlassPanel>
          ))}
        </ul>
      )}
    </div>
  );
}
